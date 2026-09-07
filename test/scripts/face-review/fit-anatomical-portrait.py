"""Fit image projection on a continuous anatomical prior without replacing Z.

Inputs are a frozen source model, its measured frontal image, and the supplied
portrait's recorded landmarks/pose. The result is a small radial-field record,
not a photographed texture or an opaque fitted mesh. Runtime TypeScript applies
the same field to shared skin and optical attachment centres.
"""
from pathlib import Path
import hashlib
import json
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
WORK = ROOT / ".shots/face-experiment/surface-study"
CAPTURE = WORK / "measurement-capture"
source_bytes = (WORK / "model.json").read_bytes()
source = json.loads(source_bytes)
receipt = json.loads((CAPTURE / "capture.json").read_text())
measurement = json.loads((WORK / "measurement.json").read_text())
target = json.loads((WORK / "target.json").read_text())
profile = json.loads((CAPTURE / "capture-profile.json").read_text())
digest = lambda value: hashlib.sha256(value).hexdigest()
if digest(source_bytes) != receipt["artifact"]["model"]:
    raise ValueError("The measured image and source model have different bases")
if digest((CAPTURE / "front.png").read_bytes()) != measurement["imageSha256"]:
    raise ValueError("The source landmark image is stale")
observed = measurement["observation"]["result"]["faceLandmarks"][0]

# Semantic landmark identities are independent of either mesh's vertex IDs.
# Skin ray intersections supply their actual 3D source positions. Iris markers
# drive the separate gaze fit and never become skin deformation constraints.
oval = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109]
eyes = [33,246,161,160,159,158,157,173,133,7,163,144,145,153,154,155,362,398,384,385,386,387,388,466,263,382,381,380,374,373,390,249]
mouth = [61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185,78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191]
nose = [1,2,4,5,6,19,94,97,98,115,168,195,197,326,327,344]
brows = [70,63,105,66,107,46,53,52,65,55,336,296,334,293,300,285,295,282,283,276]
identities = list(dict.fromkeys(oval + eyes + mouth + nose + brows + [92,322,186,410,57,287]))
skin = [p["geometry"]["mesh"] for p in source["parts"] if p["id"].startswith("anatomical-")]
# The actual renderer consumes Float32 GLTF positions. Quantize before measuring
# rays, then use Float64 millimetres for the solve's arithmetic.
points = [np.asarray(m["positions"], dtype=np.float32).astype(np.float64).reshape(-1,3)*1000 for m in skin]
triangles = np.concatenate([p[np.asarray(m["indices"]).reshape(-1,3)] for p,m in zip(points,skin)])
a, e1, e2 = triangles[:,0], triangles[:,1]-triangles[:,0], triangles[:,2]-triangles[:,0]
all_points = np.concatenate(points)
camera = np.asarray(profile["camera"]["target"])*1000
camera[2] += profile["camera"]["distance"]*1000
tan = np.tan(np.deg2rad(profile["camera"]["verticalFov"])/2)
aspect = profile["image"]["width"]/profile["image"]["height"]
delta = camera-a
cross2 = np.cross(delta,e1)
projected = np.column_stack([all_points[:,0]/(camera[2]-all_points[:,2])/(tan*aspect),(all_points[:,1]-camera[1])/(camera[2]-all_points[:,2])/tan])
rotation = np.asarray(target["captureBasis"]["rotation"]).reshape(3,3)
plane = rotation[:2,:2]
origins, requested, fallbacks = [], [], []
for identity in identities:
    landmark = observed[identity]
    screen = np.asarray([2*landmark["x"]-1,1-2*landmark["y"]])
    ray = np.asarray([screen[0]*tan*aspect,screen[1]*tan,-1])
    cross1 = np.cross(ray,e2)
    denominator = np.einsum("ij,ij->i",e1,cross1)
    valid = np.abs(denominator)>1e-10
    inverse = np.divide(1,denominator,out=np.zeros_like(denominator),where=valid)
    u = np.einsum("ij,ij->i",delta,cross1)*inverse
    v = (cross2@ray)*inverse
    distance = np.einsum("ij,ij->i",e2,cross2)*inverse
    valid &= (u>=0)&(v>=0)&(u+v<=1)&(distance>0)
    if np.any(valid):
        point = camera+ray*np.min(distance[valid])
    else:
        error = np.sum((projected-screen)**2,axis=1)
        error[all_points[:,2]<0] = np.inf
        point = all_points[np.argmin(error)]
        fallbacks.append(identity)
    desired = np.asarray(target["positions"][identity])
    # R[:2] describes the photograph's two projection coordinates. Fixing Z to
    # the prior requires solving both X/Y together; simply replacing target Z
    # would move the photographed feature under the recorded head rotation.
    destination_xy = np.linalg.solve(plane,rotation[:2]@desired-rotation[:2,2]*point[2])
    origins.append(point)
    requested.append(destination_xy-point[:2])

# Fixed anchors cover unseen posterior skin and the low neck. They constrain the
# field outside the observed face without inventing another target photograph.
hidden = all_points[(all_points[:,2]<-45)|(all_points[:,1]<-100)]
anchors = [hidden[0]]
nearest = np.sum((hidden-anchors[0])**2,axis=1)
for _ in range(63):
    selected = hidden[np.argmax(nearest)]
    anchors.append(selected)
    nearest = np.minimum(nearest,np.sum((hidden-selected)**2,axis=1))
origins = np.asarray(origins)
centres = np.concatenate([origins,anchors])/100
values = np.concatenate([requested,np.zeros((len(anchors),2))])
squared = np.sum((centres[:,None]-centres[None,:])**2,axis=2)
kernel = np.zeros_like(squared)
positive = squared>0
kernel[positive] = .5*squared[positive]*np.log(squared[positive])
polynomial = np.column_stack([np.ones(len(centres)),centres])
# The regularizer is dimensionless relative to the normalized radial kernel.
# It damps nearly coincident detector constraints; it is not a tissue thickness.
smoothing = 1e-4
matrix = np.block([[kernel+smoothing*np.eye(len(centres)),polynomial],[polynomial.T,np.zeros((4,4))]])
coefficients = np.linalg.solve(matrix,np.concatenate([values,np.zeros((4,2))]))
weights, affine = coefficients[:-4], coefficients[-4:]
predicted = kernel@weights+polynomial@affine
residual = predicted[:len(origins)]-np.asarray(requested)
mapped = origins.copy()
mapped[:,:2] += predicted[:len(origins)]
output = {
    "scale":100,"centres":centres.tolist(),"weights":weights.tolist(),"affine":affine.tolist(),
    "gazeOrigins":[target["positions"][468],target["positions"][473]],"viewRay":target["viewRay"],
    "landmarks":{str(i):p.tolist() for i,p in zip(identities,mapped)},
    "basis":{"sourceModelSha256":digest(source_bytes),"sourceGltfSha256":receipt["artifact"]["gltf"],"sourceImageSha256":measurement["imageSha256"],"targetInputSha256":target["inputSha256"],"smoothing":smoothing,"depth":"anatomical prior preserved","rayFallbacks":fallbacks,"xyResidualMmRms":np.sqrt(np.mean(residual**2,axis=0)).tolist()},
}
destination = ROOT / "test/src/subjects/generated-korean-girl-01/surfaceFit.json"
destination.write_text(json.dumps(output,separators=(",",":")),encoding="utf8")
print("Fitted",len(origins),"observations;",len(fallbacks),"fallback rays; XY RMS mm",output["basis"]["xyResidualMmRms"])
