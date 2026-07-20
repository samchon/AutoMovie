# Render a MakeHuman .mhm with MPFB2's procedural (enhanced) skin in Blender Cycles.
# Run: blender --background --online-mode --python mpfb_render.py -- <in.mhm> <out.png>
import bpy, sys, math, os, addon_utils

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
MHM = argv[0]
OUT = argv[1] if len(argv) > 1 else "D:/github/samchon/motica/.shots/mpfb/out.png"
os.makedirs(os.path.dirname(OUT), exist_ok=True)

# clear default scene objects (do NOT factory-reset: that disables the extension)
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

# enable MPFB extension and import its services from the bl_ext namespace
for mod in ("bl_ext.blender_org.mpfb", "bl_ext.user_default.mpfb", "mpfb"):
    try:
        bpy.ops.preferences.addon_enable(module=mod); print(">>> enabled", mod, flush=True); break
    except Exception as e:
        print(">>> enable fail", mod, e, flush=True)
try:
    from bl_ext.blender_org.mpfb.services.humanservice import HumanService
    from bl_ext.blender_org.mpfb.services.materialservice import MaterialService
except ModuleNotFoundError:
    from mpfb.services.humanservice import HumanService
    from mpfb.services.materialservice import MaterialService

settings = HumanService.get_default_deserialization_settings()
settings["clothes_deep_search"] = False
settings["bodypart_deep_search"] = False
settings["override_skin_model"] = "ENHANCED"  # procedural photoreal skin
print(">>> loading mhm", MHM, flush=True)
human = HumanService.deserialize_from_mhm(MHM, settings)
print(">>> human:", human.name, "verts", len(human.data.vertices), flush=True)

# procedural enhanced skin (v2): the photoreal MPFB skin shader
try:
    MaterialService.create_v2_skin_material("mpfb_skin", human)
    print(">>> applied v2 skin", flush=True)
except Exception as e:
    print(">>> skin err:", e, flush=True)

# world light
world = bpy.data.worlds.new("w"); world.use_nodes = True
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
world.node_tree.nodes["Background"].inputs[0].default_value = (0.85, 0.87, 0.9, 1)
bpy.context.scene.world = world

# bounding box of the head (top of the basemesh)
import mathutils
bb = [human.matrix_world @ mathutils.Vector(c) for c in human.bound_box]
xs = [v.x for v in bb]; ys = [v.y for v in bb]; zs = [v.z for v in bb]
top = max(zs); bot = min(zs); h = top - bot
cx = (min(xs) + max(xs)) / 2
headZ = top - 0.085 * h          # face/eye height just below crown
faceY = min(ys)                  # MakeHuman faces -Y in Blender
span = 0.11 * h                  # ~head radius
target = mathutils.Vector((cx, faceY, headZ))

# key/fill/rim lights (head-scaled)
def lamp(name, loc, energy, size):
    d = bpy.data.lights.new(name, 'AREA'); d.energy = energy; d.size = size
    o = bpy.data.objects.new(name, d); o.location = loc; bpy.context.collection.objects.link(o); return o
lamp("key", (cx + span, faceY - span * 1.6, headZ + span * 0.8), 30, span)
lamp("fill", (cx - span * 1.8, faceY - span, headZ), 12, span * 1.5)
lamp("rim", (cx, max(ys) + span, headZ + span), 18, span)

# camera tight on the face
cam_d = bpy.data.cameras.new("cam"); cam_d.lens = 80
cam = bpy.data.objects.new("cam", cam_d)
dist = span * 4.2               # close enough to fill frame with the head
cam.location = (cx, faceY - dist, headZ)
# aim at head
to = mathutils.Vector((cx, faceY, headZ)) - cam.location
cam.rotation_euler = to.to_track_quat('-Z', 'Y').to_euler()
bpy.context.collection.objects.link(cam)
bpy.context.scene.camera = cam

# Cycles render (try GPU/HIP, fallback CPU)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 96
scene.render.resolution_x = 720; scene.render.resolution_y = 720
scene.render.film_transparent = False
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for ctype in ('HIP', 'ONEAPI', 'CUDA', 'OPTIX'):
        try:
            prefs.compute_device_type = ctype; prefs.get_devices()
            if any(d.type == ctype for d in prefs.devices):
                for d in prefs.devices: d.use = (d.type == ctype or d.type == 'CPU')
                scene.cycles.device = 'GPU'; print(">>> GPU", ctype, flush=True); break
        except Exception:
            continue
except Exception as e:
    print(">>> GPU setup failed, CPU:", e, flush=True)

scene.render.filepath = OUT
print(">>> rendering...", flush=True)
bpy.ops.render.render(write_still=True)
print(">>> WROTE", OUT, flush=True)
