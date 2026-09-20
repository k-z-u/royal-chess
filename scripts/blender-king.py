# Blender: build the Royal Chess king piece.
#
#   Blender > Scripting > Open... > scripts/blender-king.py > Run Script
#
# Or headless, which also writes .blend + .glb next to the script:
#
#   KING_EXPORT=1 blender --background --python scripts/blender-king.py
#
# The turned profile follows src/three/pieceGeometry.ts (baseProfile + the king's
# body), but everything the king *wears* is built out here rather than in code.
# The king is the piece that has to out-rank the queen at a glance, so it gets a
# jewelled crown band, eight fleurons flanked by pearls, jewel rings at the cove
# and shoulder, and the only cross on the board.
#
# Everything is built in profile units and normalised to a real-world height at
# the end; the game then rescales it to the shared height table. The turned body
# is deliberately bulked out by GIRTH, because the cross makes the piece taller
# and the game normalises by height — without it the king would come out slimmer
# than the queen. Only objects named "King" are replaced, so running this never
# wipes an existing scene.

import bpy
import math
import os

KING_HEIGHT_M = 0.095  # standard tournament king height
SEGMENTS = 96
GIRTH = 1.2  # turned parts are this much wider than the raw profile

# baseProfile() — flat underside, moulded foot, cove, stem start
BASE = [
    (0.0, 0.0), (0.2, 0.0), (0.3, 0.0), (0.322, 0.004), (0.332, 0.012),
    (0.335, 0.024), (0.332, 0.036), (0.322, 0.048), (0.302, 0.06),
    (0.276, 0.072), (0.25, 0.084), (0.228, 0.096), (0.212, 0.11),
    (0.2, 0.128), (0.192, 0.148), (0.188, 0.17),
]

# body, shoulder collar, stem, then the deep crown cup that carries the coronet
UPPER = [
    (0.196, 0.2), (0.19, 0.26), (0.184, 0.32), (0.186, 0.38), (0.198, 0.42),
    (0.214, 0.448), (0.206, 0.472),
    (0.176, 0.494), (0.152, 0.514),
    (0.17, 0.546), (0.2, 0.582), (0.232, 0.622), (0.258, 0.662), (0.272, 0.7),
    (0.278, 0.736), (0.28, 0.766),
    (0.29, 0.786), (0.292, 0.806), (0.284, 0.822),
    (0.258, 0.832), (0.232, 0.83), (0.216, 0.818),
    (0.204, 0.8), (0.196, 0.782),
    (0.186, 0.79), (0.14, 0.804), (0.08, 0.814), (0.0, 0.818),
]

PROFILE = [(x * GIRTH, y) for x, y in BASE] + [(x * GIRTH, y) for x, y in UPPER]

# ornament anchors, chosen against the profile above so each one clears the wall
BAND_R = 0.352  # jewelled band hugging the crown wall (wall is 0.348 here)
BAND_Z = 0.79
FLEURON_R = 0.282  # radius the fleurons stand at, on the crown's top rim
FLEURON_Z = 0.826
COVE_BEADS_R = 0.264  # beads sitting in the cove (profile is 0.252 there)
COVE_BEADS_Z = 0.108
SHOULDER_R = 0.266  # jewels on the shoulder collar (profile is 0.257 there)
SHOULDER_Z = 0.448
POINTS = 8


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


def add_torus(major, minor, z, major_segments=SEGMENTS, minor_segments=12):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor, location=(0, 0, z),
        major_segments=major_segments, minor_segments=minor_segments,
    )
    return bpy.context.active_object


def add_sphere(radius, z, x=0.0, y=0.0, segments=12, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=radius, segments=segments, ring_count=rings, location=(x, y, z),
    )
    return bpy.context.active_object


def add_cone(radius, depth, z_centre, x=0.0, y=0.0, vertices=18):
    bpy.ops.mesh.primitive_cone_add(
        radius1=radius, radius2=0.0, depth=depth, vertices=vertices,
        location=(x, y, z_centre),
    )
    return bpy.context.active_object


def add_box(width, depth, height, z_centre):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, z_centre))
    obj = bpy.context.active_object
    obj.scale = (width, depth, height)
    bpy.ops.object.transform_apply(scale=True)
    return obj


def ring_of(count, radius, build, phase=0.0):
    """Call build(angle, x, y) count times around a circle."""
    for i in range(count):
        a = 2.0 * math.pi * i / count + phase
        build(a, math.cos(a) * radius, math.sin(a) * radius)


def coronet():
    """The king's crown: a jewelled band below eight fleurons.

    The queen wears a plain ring of spikes; the king gets a proper coronet —
    taller points, pearls flanking each one so the group reads as fleur-de-lis,
    and a jewel in every valley between them.
    """
    parts = [add_torus(BAND_R, 0.024, BAND_Z, minor_segments=12)]

    ring_of(
        POINTS,
        BAND_R,
        lambda a, x, y: parts.append(add_sphere(0.03, BAND_Z, x, y)),
        phase=math.pi / POINTS,
    )

    for i in range(POINTS):
        a = 2.0 * math.pi * i / POINTS
        x, y = math.cos(a) * FLEURON_R, math.sin(a) * FLEURON_R
        # the point itself, then its pearl finial
        parts.append(add_cone(0.072, 0.14, FLEURON_Z + 0.07, x, y))
        parts.append(add_sphere(0.04, FLEURON_Z + 0.159, x, y, 16, 10))
        # two pearls flanking the point, angled so nothing merges
        for side in (-1.0, 1.0):
            aa = a + side * 0.44
            parts.append(
                add_sphere(
                    0.029,
                    FLEURON_Z + 0.067,
                    math.cos(aa) * FLEURON_R,
                    math.sin(aa) * FLEURON_R,
                )
            )
    return parts


def cross():
    """A heavy cross above the coronet — the king's own mark on the board."""
    parts = [
        add_torus(0.11, 0.02, 1.03, major_segments=64, minor_segments=10),
        add_box(0.08, 0.074, 0.2, 1.12),  # vertical arm, 1.02 -> 1.22
        add_box(0.235, 0.068, 0.074, 1.15),  # crossbar
        add_sphere(0.048, 1.245, segments=16, rings=10),  # capped finial
    ]
    return parts


def jewels():
    """Studs on the cove and the shoulder, so the stem reads as ornamented."""
    parts = []
    ring_of(
        20,
        COVE_BEADS_R,
        lambda a, x, y: parts.append(add_sphere(0.018, COVE_BEADS_Z, x, y)),
    )
    ring_of(
        12,
        SHOULDER_R,
        lambda a, x, y: parts.append(add_sphere(0.026, SHOULDER_Z, x, y)),
    )
    return parts


def add_material(obj):
    """A polished boxwood look for anyone opening the .blend.

    The game ignores this and applies its own piece material, but the file
    should still preview properly. The node is found by type rather than name,
    which a localised Blender renames.
    """
    mat = bpy.data.materials.new("Boxwood")
    mat.use_nodes = True
    bsdf = next(
        (n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None
    )
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.88, 0.76, 0.55, 1.0)
        bsdf.inputs["Roughness"].default_value = 0.32
        if "Coat Weight" in bsdf.inputs:  # Blender 4.x+
            bsdf.inputs["Coat Weight"].default_value = 0.85
            bsdf.inputs["Coat Roughness"].default_value = 0.16
        elif "Clearcoat" in bsdf.inputs:  # Blender 3.x
            bsdf.inputs["Clearcoat"].default_value = 0.85
            bsdf.inputs["Clearcoat Roughness"].default_value = 0.16
    else:
        mat.diffuse_color = (0.88, 0.76, 0.55, 1.0)
    obj.data.materials.append(mat)


def sharpen_edges(obj):
    """Smooth the turned surfaces, but keep the cross's corners crisp."""
    try:
        bpy.ops.object.shade_auto_smooth(angle=math.radians(38))
    except (AttributeError, RuntimeError, TypeError):
        bpy.ops.object.shade_smooth()


def build_king():
    # headless runs start from the default startup file, so clear it entirely;
    # inside the UI only a previous "King" is replaced
    remove_existing_king(clear_all=bool(os.environ.get("KING_EXPORT")))

    parts = [revolve_profile("KingBody")]
    parts += coronet()
    parts += cross()
    parts += jewels()

    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()

    king = bpy.context.active_object
    king.name = "King"

    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    sharpen_edges(king)

    # sit the piece on z = 0 and give it its real-world height
    s = KING_HEIGHT_M / king.dimensions.z
    king.scale = (s, s, s)
    bpy.ops.object.transform_apply(scale=True)
    king.location = (0.0, 0.0, -min(v[2] for v in king.bound_box))
    bpy.ops.object.transform_apply(location=True)

    add_material(king)
    return king


def project_root():
    """The repo root, whether the script runs in place or from a scratch copy."""
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(here)
    if os.path.isdir(os.path.join(root, "public")):
        return root
    return os.getcwd()  # a copy elsewhere: run blender from the project root


def export(king):
    """Write the .blend under scripts/ and the .glb where the game serves it."""
    here = os.path.dirname(os.path.abspath(__file__))
    build = os.path.join(project_root(), "scripts", ".build")
    os.makedirs(build, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(build, "king.blend"))
    bpy.ops.object.select_all(action="DESELECT")
    king.select_set(True)
    game_models = os.environ.get("KING_OUT") or os.path.join(
        project_root(), "public", "models"
    )
    os.makedirs(game_models, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(game_models, "king.glb"),
        use_selection=True,
        export_apply=True,
    )


def main():
    king = build_king()
    size = king.dimensions
    print(
        f"King built: {size.z * 100:.1f} cm tall, "
        f"{max(size.x, size.y) * 100:.1f} cm wide, "
        f"{len(king.data.polygons)} faces"
    )
    if os.environ.get("KING_EXPORT"):
        export(king)
        print("exported king.blend and king.glb")


main()
