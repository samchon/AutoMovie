"""Render a frozen AutoMovie GLTF, recording the model and inspection basis."""
import bpy
import hashlib
import json
import math
import os
import shutil
import sys
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
arguments = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
WORK = os.path.abspath(arguments[0] if arguments else os.path.join(ROOT, ".shots", "face-experiment"))
OUT = os.path.abspath(arguments[1] if len(arguments) > 1 else os.path.join(WORK, "preview-pending"))
# Blender resolves relative render paths against its own file context. Resolve
# once in the calling workspace so writing and hashing address the same file.
capture_root = os.path.join(ROOT, ".shots", "face-experiment")
if os.path.normcase(os.path.commonpath([capture_root, OUT])) != os.path.normcase(capture_root) or WORK == OUT:
    raise ValueError("Portrait captures must stay inside their workspace and apart from source exports.")
os.makedirs(OUT, exist_ok=True)
for filename in ["portrait.glb", "portrait.gltf", "portrait.bin", "model.json", "capture-profile.json", "artifact-basis.json"]:
    shutil.copyfile(os.path.join(WORK, filename), os.path.join(OUT, filename))
if os.path.exists(os.path.join(WORK, "configuration.json")):
    shutil.copyfile(os.path.join(WORK, "configuration.json"), os.path.join(OUT, "configuration.json"))
shutil.copyfile(__file__, os.path.join(OUT, "render-blender.py"))
with open(os.path.join(OUT, "capture-profile.json")) as file:
    profile = json.load(file)
with open(os.path.join(OUT, "artifact-basis.json")) as file:
    artifact = json.load(file)
selected = set(arguments[2].split(",")) if len(arguments) > 2 else None
available = {"calibration", "reference", "reference-clay", "clay", "clay-oblique"} | {view["name"] for view in profile["views"]}
if selected is not None and (not selected or not selected <= available):
    raise ValueError("Unknown measurement-frame selection.")

def digest(filename):
    with open(filename, "rb") as file:
        return hashlib.sha256(file.read()).hexdigest()

assert digest(os.path.join(OUT, "portrait.glb")) == artifact["gltf"]
assert digest(os.path.join(OUT, "model.json")) == artifact["model"]
assert digest(os.path.join(OUT, "capture-profile.json")) == artifact["profile"]
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=os.path.join(OUT, "portrait.glb"))
subjects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
root = bpy.data.objects.new("Portrait pose", None)
bpy.context.collection.objects.link(root)
for obj in subjects:
    obj.parent = root
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = profile["cycles"]["samples"]
scene.cycles.seed = 0
scene.cycles.use_denoising = profile["cycles"]["denoising"]
scene.render.resolution_x = profile["image"]["width"]
scene.render.resolution_y = profile["image"]["height"]
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "AgX"
scene.view_settings.exposure = profile["cycles"]["exposure"]
scene.render.film_transparent = False
print("RENDERER", bpy.app.version_string, "Cycles CPU", "GLTF", artifact["gltf"], flush=True)

world = bpy.data.worlds.new("Studio")
world.use_nodes = True
scene.world = world
nodes = world.node_tree.nodes
nodes.clear()
output = nodes.new("ShaderNodeOutputWorld")
light = nodes.new("ShaderNodeBackground")
light.inputs["Color"].default_value = (*profile["cycles"]["world"]["color"], 1)
light.inputs["Strength"].default_value = profile["cycles"]["world"]["strength"]
background = nodes.new("ShaderNodeBackground")
background.inputs["Color"].default_value = (*profile["cycles"]["background"]["color"], 1)
background.inputs["Strength"].default_value = profile["cycles"]["background"]["strength"]
path = nodes.new("ShaderNodeLightPath")
blend = nodes.new("ShaderNodeMixShader")
world.node_tree.links.new(path.outputs["Is Camera Ray"], blend.inputs[0])
world.node_tree.links.new(light.outputs[0], blend.inputs[1])
world.node_tree.links.new(background.outputs[0], blend.inputs[2])
world.node_tree.links.new(blend.outputs[0], output.inputs["Surface"])

def converted(point):
    return Vector((point[0], -point[2], point[1]))

def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

for spec in profile["cycles"]["lights"]:
    data = bpy.data.lights.new(spec["name"], "AREA")
    data.energy = spec["power"]
    data.shape = "DISK"
    data.size = spec["size"]
    data.color = spec["color"]
    obj = bpy.data.objects.new(spec["name"], data)
    bpy.context.collection.objects.link(obj)
    obj.location = converted(spec["position"])
    aim(obj, (0, 0, 0))
camera_data = bpy.data.cameras.new("Inspection")
camera = bpy.data.objects.new("Inspection", camera_data)
bpy.context.collection.objects.link(camera)
scene.camera = camera
camera_data.sensor_fit = "VERTICAL"
camera_data.sensor_height = 24
camera_data.lens = 24 / (2 * math.tan(math.radians(profile["camera"]["verticalFov"]) / 2))
receipts = []

def render(name, observation):
    # A numerical correspondence measurement can request one exact view. Its
    # receipt remains partial and cannot pass the complete-preview verifier.
    if selected is not None and name not in selected:
        return
    filename = os.path.join(OUT, name + ".png")
    scene.render.filepath = filename
    bpy.ops.render.render(write_still=True)
    receipts.append({"name": name, "file": name + ".png", "sha256": digest(filename), "view": observation})
    print("CAPTURED", name, flush=True)

def pose(yaw, pitch=0):
    root.matrix_world = Matrix.Identity(4)
    scene.render.resolution_y = profile["image"]["height"]
    camera_data.type = "PERSP"
    angle = math.radians(yaw)
    elevation = math.radians(pitch)
    distance = profile["camera"]["distance"]
    target = converted(profile["camera"]["target"])
    camera.location = target + converted((distance*math.cos(elevation)*math.sin(angle),distance*math.sin(elevation),distance*math.cos(elevation)*math.cos(angle)))
    aim(camera, target)

# Independent native geometry establishes axis reading and real cast shadows.
pose(0)
for obj in subjects:
    obj.hide_render = True
bpy.ops.mesh.primitive_cube_add(size=0.04, location=converted((0.05,0.02,0)))
cube = bpy.context.object
bpy.ops.mesh.primitive_plane_add(size=0.2, location=converted((0.03,0,-0.04)), rotation=(math.pi/2,0,0))
plane = bpy.context.object
red = bpy.data.materials.new("Calibration red")
red.use_nodes = True
red.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (0.8,0.035,0.01,1)
cube.data.materials.append(red)
grey = bpy.data.materials.new("Calibration grey")
grey.use_nodes = True
grey.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (0.35,0.35,0.35,1)
plane.data.materials.append(grey)
render("calibration", {"cubeMetres":0.04,"cubePosition":[0.05,0.02,0],"independentGeometry":True})
bpy.data.objects.remove(cube, do_unlink=True)
bpy.data.objects.remove(plane, do_unlink=True)
for obj in subjects:
    obj.hide_render = False

for view in profile["views"]:
    pose(view["yaw"], view.get("pitch", 0))
    render(view["name"], {"yaw":view["yaw"],"pitch":view.get("pitch",0),"mode":"colour"})

# The GLTF importer applies basis B. Conjugate the recorded image pose by B.
basis = Matrix([[1,0,0],[0,0,-1],[0,1,0]])
r = profile["measurement"]["rotation"]
rotation = Matrix([r[0:3],r[3:6],r[6:9]])
root.matrix_world = (basis @ rotation @ basis.inverted()).to_4x4()
origin = profile["measurement"]["origin"]
scale = profile["measurement"]["millimetersPerPixel"] / 1000
crop = profile["reference"]["crop"]
offset = rotation @ Vector((0,0.028,0.060))
center = Vector(((crop["x"]+crop["size"]/2-origin[0])*scale,(-crop["y"]-crop["size"]/2-origin[1])*scale,0)) + offset
scene.render.resolution_y = profile["image"]["width"]
camera_data.type = "ORTHO"
camera_data.ortho_scale = crop["size"]*scale
camera.location = (center.x,-1,center.y)
aim(camera, (center.x,0,center.y))
render("reference", {"mode":"colour","crop":crop,"pose":"recorded image pose"})

clay = bpy.data.materials.new("Inspection clay")
clay.use_nodes = True
bsdf = clay.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = (0.35,0.35,0.35,1)
bsdf.inputs["Roughness"].default_value = 0.72
for obj in subjects:
    if any(slot.material and slot.material.name in profile["clayHideMaterials"] for slot in obj.material_slots):
        obj.hide_render = True
    for slot in obj.material_slots:
        slot.material = clay
render("reference-clay", {"mode":"clay","crop":crop,"pose":"recorded image pose"})
for name, yaw in [("clay",0),("clay-oblique",45)]:
    pose(yaw)
    render(name, {"mode":"clay","yaw":yaw})
with open(os.path.join(OUT,"capture.json"),"w") as file:
    json.dump({"artifact":artifact,"renderer":{"version":bpy.app.version_string,"engine":"Cycles","device":"CPU","scriptSha256":digest(__file__)},"captures":receipts,"review":"not automatically supplied"},file,indent=2)
