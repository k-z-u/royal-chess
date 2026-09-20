# Blender: build the Royal Chess king piece.
#
#   Blender > Scripting > Open... > scripts/blender-king.py > Run Script
#
# Or headless, which also writes .blend + .glb next to the script:
#
#   KING_EXPORT=1 blender --background --python scripts/blender-king.py
#
# The profile is lifted verbatim from src/three/pieceGeometry.ts (baseProfile +
# kingProfile + crown band + cross + orb), so the result matches the king the
# game renders. The finished king stands KING_HEIGHT_M tall — 0.095 m is the
# standard tournament king height. Only objects named "King" are replaced, so
# running it never wipes an existing scene.

import bpy
import math
import os

KING_HEIGHT_M = 0.095
SEGMENTS = 96

# baseProfile() — flat underside, moulded foot, cove, stem start
PROFILE = [
    (0.0, 0.0), (0.2, 0.0), (0.3, 0.0), (0.322, 0.004), (0.332, 0.012),
    (0.335, 0.024), (0.332, 0.036), (0.322, 0.048), (0.302, 0.06),
    (0.276, 0.072), (0.25, 0.084), (0.228, 0.096), (0.212, 0.11),
    (0.2, 0.128), (0.192, 0.148), (0.188, 0.17),
]

# kingProfile() — body, collar, the wide crown, and the concave top
PROFILE += [
    (0.206, 0.2), (0.194, 0.26), (0.188, 0.34), (0.192, 0.4),
    (0.206, 0.44), (0.22, 0.462), (0.212, 0.484), (0.184, 0.502),
    (0.158, 0.52), (0.152, 0.542), (0.172, 0.568), (0.204, 0.602),
    (0.234, 0.64), (0.258, 0.682), (0.272, 0.726), (0.278, 0.768),
    (0.274, 0.802), (0.26, 0.828), (0.238, 0.844), (0.212, 0.85),
    (0.192, 0.844), (0.182, 0.83), (0.182, 0.812), (0.192, 0.798),
    (0.206, 0.79), (0.216, 0.786), (0.206, 0.778), (0.15, 0.772),
    (0.0, 0.768),
]

NATURAL_HEIGHT = 1.085  # profile base to orb tip, before normalising


def remove_existing_king(clear_all=False):
    for obj in list(bpy.data.objects):
        if clear_all or obj.name.startswith("King"):
            bpy.data.objects.remove(obj, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.materials):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def revolve_profile(name, profile=PROFILE, segments=SEGMENTS):
    """Generate the surface of revolution directly.

    A Screw modifier applied to an edge-only mesh crashes Blender 5.1 in
    background mode, so the rings are emitted by hand. Winding is chosen so
    every face points away from the axis.
    """
    verts = []
    rings = []
    for x, y in profile:
        if x <= 1e-6:
            rings.append(len(verts))
            verts.append((0.0, 0.0, y))
        else:
            start = len(verts)
            for j in range(segments):
                a = 2.0 * math.pi * j / segments
                verts.append((x * math.cos(a), x * math.sin(a), y))
            rings.append(list(range(start, start + segments)))

    faces = []
    for i in range(len(profile) - 1):
        ra, rb = rings[i], rings[i + 1]
        if isinstance(ra, list) and isinstance(rb, list):
            for j in range(segments):
                k = (j + 1) % segments
                faces.append((ra[j], ra[k], rb[k], rb[j]))
        elif isinstance(ra, list):  # ring closing onto the axis
            for j in range(segments):
                k = (j + 1) % segments
                faces.append((ra[j], ra[k], rb))
        elif isinstance(rb, list):  # axis opening onto a ring
            for j in range(segments):
                k = (j + 1) % segments
                faces.append((ra, rb[k], rb[j]))
        # both on the axis: degenerate, skip

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate(verbose=False)
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    return obj


def add_torus(major, minor, y):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor, location=(0, 0, y),
        major_segments=SEGMENTS, minor_segments=20,
    )
    return bpy.context.active_object


def add_box(size, y):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, y))
    obj = bpy.context.active_object
    obj.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(scale=True)
    return obj


def add_orb(radius, y):
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=radius, segments=32, ring_count=24, location=(0, 0, y)
    )
    return bpy.context.active_object


def add_material(obj):
    mat = bpy.data.materials.new("Boxwood")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.88, 0.76, 0.55, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.32
    if "Coat Weight" in bsdf.inputs:  # Blender 4.x+
        bsdf.inputs["Coat Weight"].default_value = 0.85
        bsdf.inputs["Coat Roughness"].default_value = 0.16
    elif "Clearcoat" in bsdf.inputs:  # Blender 3.x
        bsdf.inputs["Clearcoat"].default_value = 0.85
        bsdf.inputs["Clearcoat Roughness"].default_value = 0.16
    obj.data.materials.append(mat)


def build_king():
    # headless runs start from the default startup file, so clear it entirely;
    # inside the UI only a previous "King" is replaced
    remove_existing_king(clear_all=bool(os.environ.get("KING_EXPORT")))

    parts = [revolve_profile("KingBody")]
    # crown band, cross, finial — the same sizes as the game's kingCross()
    parts.append(add_torus(0.212, 0.028, 0.858))
    parts.append(add_box((0.05, 0.19, 0.05), 0.945))   # vertical arm
    parts.append(add_box((0.05, 0.05, 0.14), 0.975))   # horizontal arm
    parts.append(add_orb(0.03, 1.055))                 # finial

    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()

    king = bpy.context.active_object
    king.name = "King"

    # sit the piece on z = 0 and set its real-world height
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    king.scale = (KING_HEIGHT_M / NATURAL_HEIGHT,) * 3
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()

    add_material(king)
    return king


def export(king):
    """Write the .blend next to the script and the .glb where the game serves it."""
    here = os.path.dirname(os.path.abspath(__file__))
    build = os.path.join(here, ".build")
    os.makedirs(build, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(build, "king.blend"))
    bpy.ops.object.select_all(action="DESELECT")
    king.select_set(True)
    game_models = os.path.join(os.path.dirname(here), "public", "models")
    os.makedirs(game_models, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(game_models, "king.glb"),
        use_selection=True,
        export_apply=True,
    )


def main():
    king = build_king()
    height_cm = king.dimensions.z * 100
    print(f"King built: {height_cm:.1f} cm tall, {len(king.data.polygons)} faces")
    if os.environ.get("KING_EXPORT"):
        export(king)
        print("exported king.blend and king.glb")


main()
