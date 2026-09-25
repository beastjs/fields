/** Seed data shared by the running demo and the exported example. Prices are integer USD cents. */
export const categories = ['All', 'Robot arms', 'Grippers', 'Vision', 'Controllers', 'Workbench', 'Accessories'] as const
export type Category = typeof categories[number]
export interface StoreProduct {
  sku: string
  name: string
  category: Exclude<Category, 'All'>
  price: number
  description: string
  detail: string
  specs: string[]
  color: string
  badge: string
  stock: number
  shape: number
}
const rows: [string, string, StoreProduct['category'], number, string, string, string[], string, string, number][] = [
  ['ARM-01', 'Arc desktop arm', 'Robot arms', 129900, 'Big ideas. A smaller footprint.', 'A compact six-axis companion for prototyping pick-and-place workflows on your own bench.', ['6 axes', '350 mm reach', '500 g payload'], '#4d8c88', 'Bestseller', 18],
  ['ARM-02', 'Reach studio arm', 'Robot arms', 189900, 'A little more room to move.', 'A longer working envelope and a rigid aluminum base for ambitious tabletop experiments.', ['6 axes', '500 mm reach', '750 g payload'], '#d19773', 'New', 12],
  ['ARM-03', 'Pivot mini', 'Robot arms', 74900, 'Your first useful robot.', 'An approachable four-axis arm for learning motion planning and physical computing.', ['4 axes', '220 mm reach', '250 g payload'], '#e0b94f', '', 24],
  ['ARM-04', 'Fold travel arm', 'Robot arms', 99900, 'Pack a whole workshop.', 'A folding mechanism that travels flat and opens into a capable desktop motion platform.', ['5 axes', '300 mm reach', 'USB-C power'], '#a8af96', '', 9],
  ['ARM-05', 'Arc precision', 'Robot arms', 249900, 'Small movements. Real possibility.', 'Our fine-motion study platform, designed for repetitive assembly and precise positioning.', ['6 axes', '0.1 mm repeatability', '1 kg payload'], '#7b94aa', 'Studio pick', 7],
  ['ARM-06', 'Link collaborative arm', 'Robot arms', 329900, 'Made to work beside you.', 'A research-grade collaborative platform with force sensing and a generously sized work envelope.', ['7 axes', '600 mm reach', 'Force sensing'], '#727e72', '', 0],
  ['GRP-01', 'Soft touch gripper', 'Grippers', 16900, 'A gentler kind of grip.', 'Compliant fingers adapt to irregular shapes, delicate objects, and beautifully imperfect prototypes.', ['2 fingers', 'Silicone pads', '80 mm opening'], '#4d8c88', 'Bestseller', 32],
  ['GRP-02', 'Pinch parallel gripper', 'Grippers', 22900, 'Hold your next idea.', 'A dependable parallel jaw mechanism with replaceable pads and adjustable grip force.', ['60 mm stroke', 'Force control', 'Quick mount'], '#d19773', '', 21],
  ['GRP-03', 'Vacuum lift kit', 'Grippers', 11900, 'Less grip. More lift.', 'A compact suction tool for handling smooth sheets, panels, and lightweight assemblies.', ['3 cup sizes', 'Mini pump', 'Pressure sensor'], '#e0b94f', '', 28],
  ['GRP-04', 'Three finger hand', 'Grippers', 34900, 'A different way to hold on.', 'Three independently compliant fingers open up experiments with more complex object geometry.', ['3 fingers', '100 mm envelope', 'Modular tips'], '#a8af96', 'New', 11],
  ['GRP-05', 'Magnetic pickup', 'Grippers', 8900, 'A strong first impression.', 'A switchable magnetic tool for sorting steel components and exploring material handling.', ['Switchable field', '24 V input', 'Status LED'], '#7b94aa', '', 35],
  ['GRP-06', 'Precision tweezer', 'Grippers', 19900, 'For the almost invisible.', 'Fine replaceable tips bring very small parts into reach for your next delicate assembly study.', ['ESD-safe tips', '20 mm opening', 'Fine force mode'], '#727e72', '', 16],
  ['VIS-01', 'Focus depth camera', 'Vision', 29900, 'See in a new dimension.', 'A compact stereo module for depth maps, object detection, and spatial experimentation.', ['Stereo depth', 'USB 3', '90° field of view'], '#4d8c88', 'Bestseller', 26],
  ['VIS-02', 'Scout wide camera', 'Vision', 14900, 'A wider point of view.', 'A wide-angle camera for observing an entire work surface without moving your sensor.', ['120° field of view', '1080p', 'Adjustable mount'], '#d19773', '', 40],
  ['VIS-03', 'Macro inspection lens', 'Vision', 18900, 'Look a little closer.', 'Reveal the small details with a fixed-focus macro camera and integrated diffuse illumination.', ['5× magnification', 'Ring light', 'Manual focus'], '#e0b94f', 'New', 14],
  ['VIS-04', 'Halo light ring', 'Vision', 7900, 'Good light changes everything.', 'A dimmable diffuse ring that helps cameras see edges and surfaces without harsh reflections.', ['Dimmable', '90 mm diameter', 'Neutral illumination'], '#a8af96', '', 45],
  ['VIS-05', 'Field sensor array', 'Vision', 21900, 'Give your project some senses.', 'An array of distance and proximity sensors for prototyping responsive physical systems.', ['8 channels', 'I²C interface', 'Mounting rail'], '#7b94aa', '', 19],
  ['VIS-06', 'Marker calibration kit', 'Vision', 4900, 'A common frame of reference.', 'Durable calibration boards and fiducial markers to help align cameras with your work.', ['6 boards', 'Matte finish', 'Storage sleeve'], '#727e72', '', 60],
  ['CTL-01', 'Core motion controller', 'Controllers', 24900, 'The brain of the operation.', 'A compact control unit connecting your ideas to motors, sensors, and the world beyond the screen.', ['6 motor channels', 'Ethernet + USB', 'Open protocol'], '#4d8c88', 'Studio pick', 30],
  ['CTL-02', 'Pulse motor driver', 'Controllers', 9900, 'Put a thought in motion.', 'A quiet driver board with adjustable current limits for small robotics and kinetic projects.', ['4 channels', '12–24 V', 'Current limiting'], '#d19773', '', 42],
  ['CTL-03', 'Bridge I/O hub', 'Controllers', 7900, 'Make the connections.', 'A clearly labeled breakout hub for wiring a bench full of sensors and actuators.', ['16 digital I/O', '8 analog inputs', 'DIN mount'], '#e0b94f', '', 50],
  ['CTL-04', 'Dial teach pendant', 'Controllers', 17900, 'Think with your hands.', 'Jog an arm, save a position, and explore motion using a tactile handheld interface.', ['Rotary encoder', 'OLED display', 'Stop button'], '#a8af96', 'New', 17],
  ['CTL-05', 'Sense force module', 'Controllers', 12900, 'Know when to ease up.', 'A compact sensing module for experimenting with contact, resistance, and feedback.', ['6-axis sensing', 'USB output', 'Calibration file'], '#7b94aa', '', 23],
  ['CTL-06', 'Sync timing board', 'Controllers', 5900, 'Everyone, together now.', 'Coordinate camera captures and actuator signals with a simple hardware timing board.', ['8 triggers', 'Microsecond timing', 'Status indicators'], '#727e72', '', 31],
  ['WRK-01', 'Grid work surface', 'Workbench', 15900, 'A place for things to happen.', 'A sturdy perforated work surface that makes mounting and rearranging prototypes effortless.', ['400 × 300 mm', 'M4 grid', 'Anodized aluminum'], '#4d8c88', 'Bestseller', 20],
  ['WRK-02', 'Orbit rotary stage', 'Workbench', 27900, 'Another angle on everything.', 'A smooth motorized turntable for scanning, positioning, and product photography experiments.', ['360° rotation', '150 mm platform', 'USB control'], '#d19773', '', 15],
  ['WRK-03', 'Rail linear slide', 'Workbench', 19900, 'A straight line to possibility.', 'Add a dependable linear axis to your setup with a compact, belt-driven motion rail.', ['300 mm travel', 'Belt drive', 'Limit switches'], '#e0b94f', '', 22],
  ['WRK-04', 'Bench starter system', 'Workbench', 49900, 'Start making sooner.', 'A work surface, fixture set, power supply, and cable kit: the foundation of a useful little lab.', ['12-piece system', '24 V supply', 'Quick-start guide'], '#a8af96', 'New', 10],
  ['WRK-05', 'Fixture block set', 'Workbench', 6900, 'Hold that thought in place.', 'A family of reusable blocks for positioning parts and building repeatable workholding setups.', ['8 blocks', 'M4 hardware', 'Mixed profiles'], '#7b94aa', '', 48],
  ['WRK-06', 'Desk conveyor', 'Workbench', 39900, 'Keep the good ideas moving.', 'A miniature conveyor for sorting experiments, machine vision, and tabletop production studies.', ['500 mm belt', 'Variable speed', 'Reversible'], '#727e72', 'Small batch', 6],
  ['ACC-01', 'Everyday cable kit', 'Accessories', 3900, 'The little things that connect us.', 'A tidy selection of flexible cables in useful lengths, with labels you can actually read.', ['12 cables', 'USB + signal', 'Reusable ties'], '#4d8c88', '', 70],
  ['ACC-02', 'Quick-change adapter', 'Accessories', 5900, 'Change your mind in seconds.', 'Swap end effectors without rebuilding your setup using a simple mechanical quick-release.', ['Universal plate', 'Tool-free release', 'Alignment pins'], '#d19773', '', 39],
  ['ACC-03', 'Power desktop supply', 'Accessories', 8900, 'A dependable source of energy.', 'A compact power supply with clearly visible output readings and adjustable limits.', ['24 V / 5 A', 'Current display', 'Desk enclosure'], '#e0b94f', '', 29],
  ['ACC-04', 'Field notes notebook', 'Accessories', 1800, 'Before the code, the sketch.', 'Dot-grid pages for rough diagrams, useful mistakes, and the next thing you want to build.', ['160 pages', 'Dot grid', 'Lay-flat binding'], '#a8af96', 'Studio pick', 90],
  ['ACC-05', 'Workshop tote', 'Accessories', 2900, 'Carry a few possibilities.', 'A heavy canvas bag sized for notebooks, components, and ambitious plans.', ['Organic canvas', 'Internal pocket', 'Reinforced handles'], '#7b94aa', '', 55],
  ['ACC-06', 'Assembly tool roll', 'Accessories', 7900, 'Good tools. Within reach.', 'A compact roll of the hand tools we reach for most often around the workbench.', ['9 tools', 'Metric sizes', 'Canvas roll'], '#727e72', '', 34],
]
export const storeProducts: StoreProduct[] = rows.map(([sku, name, category, price, description, detail, specs, color, badge, stock], index) => ({
  sku, name, category, price, description, detail, specs, color, badge, stock, shape: Math.floor(index / 6)
}))
