// ============================================================
//  Drywall Panel Hoist  —  Parametric Model  (OpenSCAD)
//
//  Systems:  tripod base · telescoping mast · side winch wheel ·
//            cradle · crossarms · extensions · support hooks
//
//  Units: millimetres.  Z = up.  X = cradle span (the 8' direction).
//  Y = depth (winch is mounted on the +Y / operator face).
//  Default configuration is sized for a standard 4'x8' (1219 x 2438 mm) sheet.
// ============================================================

/* [Working Height & Motion States] */
// Cradle (working) height above the floor. Auto-clamped to a valid telescoping range.
working_height    = 2600;   // [1780:10:3140]
// Cradle tilt: 0 = horizontal working state, positive = tilted loading state.
cradle_tilt       = 0;      // [0:5:35]
// Crossarm extensions: 0 = retracted, 1 = extended.
extension_position = 1;     // [0,1]
// Support hooks: 0 = closed (storage), 1 = open (in use).
hook_state        = 1;      // [0,1]
// Optional translucent 4'x8' reference panel (for scale only).
show_panel        = false;

/* [Tripod Base] */
tripod_spread     = 1600;   // caster-to-caster spread (mm)
tripod_leg_w      = 46;     // leg square section (mm)
leg_attach_z      = 360;    // height at which the legs meet the mast (mm)
caster_dia        = 125;    // caster wheel diameter (mm)

/* [Telescoping Mast] */
mast_base_z       = 180;    // bottom of the outer post above the floor (mm)
outer_post_size   = 84;     // outer (lower) post square section (mm)
outer_post_wall   = 6;      // outer post wall thickness (mm)
outer_post_len    = 1620;   // outer post length (mm)
inner_post_size   = 66;     // inner (upper) post square section (mm)
inner_post_wall   = 5;      // inner post wall thickness (mm)
inner_post_len    = 1600;   // inner post length (mm)
mast_overlap_min  = 260;    // minimum nesting overlap between posts (mm)

/* [Winch Wheel Assembly] */
winch_wheel_dia   = 420;    // hand-wheel diameter (mm)
winch_center_z    = 900;    // winch axle height above the floor (mm)
winch_standoff    = 95;     // wheel-plane offset from the mast face (mm)
winch_handle_len  = 150;    // crank-knob length (mm)

/* [Cradle, Crossarms, Extensions, Hooks] */
cradle_width      = 1000;   // spacing between the two crossarms (mm)
crossarm_length   = 1500;   // each crossarm length (mm)
crossarm_w        = 52;     // crossarm square section (mm)
ext_w             = 38;     // extension square section (mm)
ext_protrude_ret  = 70;     // extension reach when retracted (mm)
ext_protrude_ext  = 469;    // extension reach when extended (mm) -> 2438 total span (8')
hook_len          = 130;    // support-hook height (mm)
hook_lip          = 46;     // support-hook lip reach (mm)
hook_th           = 26;     // support-hook bar thickness (mm)

/* [Render Quality] */
$fn = 36;

// ===================== Derived values (do not edit) =====================
function clamp(x, lo, hi) = max(lo, min(hi, x));

mast_height  = outer_post_len + inner_post_len;          // overall mast length (both sections)
wh_min       = mast_base_z + inner_post_len;             // fully retracted cradle height
wh_max       = mast_base_z + mast_height - mast_overlap_min;  // fully extended cradle height
cradle_z     = clamp(working_height, wh_min, wh_max);    // actual cradle pivot height
inner_bottom = cradle_z - inner_post_len;                // bottom of the sliding inner post
outer_top    = mast_base_z + outer_post_len;             // top of the fixed outer post

caster_h     = caster_dia + 18;                          // total caster height
leg_tip_z    = caster_h;                                 // height of the leg/caster junction

ext_protrude = (extension_position == 1) ? ext_protrude_ext : ext_protrude_ret;
ext_len      = ext_protrude_ext + 120;                   // extension tube length
ext_tip      = crossarm_length/2 + ext_protrude;         // |X| of each extension tip

// Palette (helps each system read as discrete geometry)
col_frame = [0.20, 0.20, 0.23];   // fixed structural steel
col_move  = [0.46, 0.46, 0.50];   // sliding / moving parts
col_dark  = [0.12, 0.12, 0.12];   // wheels, caps, rubber
col_cable = [0.62, 0.62, 0.64];   // wire rope

// ===================== Generic helpers =====================
// Rotate children so local +Z maps onto direction vector v.
module orient(v) {
    l = norm(v);
    if (l < 1e-6) children();
    else {
        ax = cross([0, 0, 1], v);
        if (norm(ax) < 1e-6) { if (v[2] < 0) rotate([180, 0, 0]) children(); else children(); }
        else rotate(a = acos(v[2] / l), v = ax) children();
    }
}

// Square-section bar spanning from point p1 to point p2.
module bar_between(p1, p2, w) {
    v = [p2[0]-p1[0], p2[1]-p1[1], p2[2]-p1[2]];
    translate(p1) orient(v) translate([-w/2, -w/2, 0]) cube([w, w, norm(v)]);
}

// Hollow square tube along +Z, centred in XY.
module sq_tube(size, len, wall) {
    difference() {
        translate([-size/2, -size/2, 0]) cube([size, size, len]);
        translate([-(size/2 - wall), -(size/2 - wall), -1]) cube([size - 2*wall, size - 2*wall, len + 2]);
    }
}

// ===================== Tripod base =====================
// Origin at the leg tip; builds downward so the wheel meets the floor (global z = 0).
module caster() {
    color(col_move) translate([0, 0, -9]) cube([74, 74, 18], center = true);     // swivel plate
    translate([0, 0, -18 - caster_dia/2]) {
        color(col_dark) rotate([90, 0, 0]) cylinder(h = 46, d = caster_dia, center = true);   // wheel
        color(col_move) for (s = [-1, 1])
            translate([0, s*27, 0]) cube([caster_dia, 6, caster_dia + 8], center = true);      // fork
    }
}

module tripod_leg(angle) {
    R   = tripod_spread/2;
    hub = [0, 0, leg_attach_z];
    tip = [R*cos(angle), R*sin(angle), leg_tip_z];
    color(col_frame) bar_between(hub, tip, tripod_leg_w);
    translate(tip) caster();
}

module tripod_base() {
    // central hub block that ties the legs to the mast foot
    color(col_frame) translate([0, 0, leg_attach_z])
        cube([outer_post_size + 24, outer_post_size + 24, 96], center = true);
    // three matching legs at 120 deg spacing (one to the rear, two to the front)
    for (a = [90, 210, 330]) tripod_leg(a);
}

// ===================== Telescoping mast =====================
module telescoping_mast() {
    // fixed outer (lower) post
    color(col_frame) translate([0, 0, mast_base_z]) sq_tube(outer_post_size, outer_post_len, outer_post_wall);
    // sliding inner (upper) post — its protrusion above the outer post sets the working height
    color(col_move)  translate([0, 0, inner_bottom]) sq_tube(inner_post_size, inner_post_len, inner_post_wall);
    // pulley head / housing at the top of the inner post (cradle mounts here)
    color(col_frame) translate([0, 0, cradle_z - 40])
        cube([inner_post_size + 30, inner_post_size + 30, 80], center = true);

    // front bracing truss on the winch (+Y) side
    yf   = outer_post_size/2;
    legA = [0, tripod_spread*0.22, leg_tip_z + 70];
    color(col_frame) {
        bar_between([0, yf, winch_center_z + 170], legA, 34);
        bar_between([0, yf, winch_center_z - 170], [0, tripod_spread*0.10, leg_attach_z], 30);
    }
}

// ===================== Winch wheel assembly =====================
// Wheel disc in the X-Z plane, axle along Y, centred at the origin.
module winch_wheel() {
    d = winch_wheel_dia; depth = 28; rim_w = d*0.06;
    color(col_dark) rotate([-90, 0, 0]) translate([0, 0, -depth/2]) {
        difference() {                                   // rim
            cylinder(h = depth, d = d);
            translate([0, 0, -1]) cylinder(h = depth + 2, d = d - 2*rim_w);
        }
        cylinder(h = depth, d = d*0.18);                 // hub
        for (i = [0:4]) rotate([0, 0, i*72])             // five spokes
            translate([d/4, 0, depth/2]) cube([d/2 - rim_w, rim_w*0.6, depth*0.55], center = true);
    }
}

module winch_assembly() {
    yf = outer_post_size/2;
    // axle / mount stub from the mast face out to the wheel hub
    color(col_frame) translate([0, yf, winch_center_z]) rotate([-90, 0, 0]) cylinder(h = winch_standoff, d = 48);
    // mounting gusset against the mast
    color(col_frame) translate([0, yf + 10, winch_center_z]) cube([150, 20, 150], center = true);

    translate([0, yf + winch_standoff, winch_center_z]) {
        winch_wheel();
        // crank knob near the rim
        r = winch_wheel_dia/2 - 46;
        color(col_move) translate([r, 0, 0]) rotate([-90, 0, 0]) cylinder(h = winch_handle_len, d = 20);
        color(col_dark) translate([r, winch_handle_len, 0]) sphere(d = 34);
    }

    // wire rope running from the winch up to the mast head (lifting link)
    color(col_cable) bar_between([0, yf + 14, winch_center_z + winch_wheel_dia*0.30],
                                 [0, inner_post_size/2, cradle_z - 70], 7);
}

// ===================== Cradle / crossarms / extensions / hooks =====================
module crossarm() {
    color(col_frame) translate([-crossarm_length/2, -crossarm_w/2, 0])
        cube([crossarm_length, crossarm_w, crossarm_w]);
}

// One telescoping extension on side s (-1 / +1). Driven by extension_position.
module extension(s) {
    z0 = (crossarm_w - ext_w)/2;
    color(col_move) translate([min(s*(ext_tip - ext_len), s*ext_tip), -ext_w/2, z0])
        cube([ext_len, ext_w, ext_w]);
    color(col_dark) translate([s*ext_tip, 0, z0 + ext_w/2]) rotate([0, 90, 0])
        cylinder(h = 8, d = ext_w*1.1, center = true);   // end cap
}

// Right-side reference hook: finger up (+Z), retaining lip pointing inward (-X).
module support_hook_ref() {
    color(col_frame) {
        translate([-hook_th/2, -hook_th/2, 0]) cube([hook_th, hook_th, hook_len]);
        translate([-hook_lip, -hook_th/2, hook_len - hook_th]) cube([hook_lip, hook_th, hook_th]);
    }
}

// Support hook on side s. hook_state: 1 = open (upright), 0 = closed (folded inward for storage).
module support_hook(s) {
    rotate([0, (hook_state == 1) ? 0 : -s*90, 0])
        if (s > 0) support_hook_ref(); else mirror([1, 0, 0]) support_hook_ref();
}

// A complete crossarm: fixed arm + two extensions + two end hooks.
module crossarm_assembly() {
    ext_top = (crossarm_w - ext_w)/2 + ext_w;   // top face of the extension tube
    crossarm();
    for (s = [-1, 1]) {
        extension(s);
        // hook seats on the extension tip, embedded slightly for a clean joint
        translate([s*ext_tip, 0, ext_top - 3]) support_hook(s);
    }
}

// Full cradle. Local origin at the mast-top pivot; tilts about the long (X) axis.
module cradle() {
    rotate([cradle_tilt, 0, 0]) {
        // hinge bracket onto the mast head
        color(col_move) translate([0, 0, -26]) cube([crossarm_w + 22, crossarm_w + 22, 46], center = true);
        // cradle beam (spine running front-to-back, along Y)
        color(col_frame) translate([-crossarm_w/2, -cradle_width/2, 0]) cube([crossarm_w, cradle_width, crossarm_w]);
        // two matching crossarms, one over each end of the beam
        for (sy = [-1, 1]) translate([0, sy*cradle_width/2, crossarm_w*0.6]) crossarm_assembly();
        // optional reference panel (4' x 8')
        if (show_panel) color([0.92, 0.90, 0.84, 0.45])
            translate([-1219, -1219/2, crossarm_w*1.6]) cube([2438, 1219, 13]);
    }
}

// ===================== Final assembly =====================
module panel_hoist() {
    tripod_base();
    telescoping_mast();
    winch_assembly();
    translate([0, 0, cradle_z]) cradle();
}

panel_hoist();
