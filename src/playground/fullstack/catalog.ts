/** Gallery copy and creative briefs stay separate from the downloadable app source. */
export const fullstackApps = [
  {
    id: 'form', number: '01', title: 'Form Supply', category: 'Experimental commerce',
    description: 'A hardware showroom with a playful engineering soul. Big objects, electric blue, and a collection that invites you to get your hands on an idea.',
    tags: ['Interactive showroom', '36 illustrated objects', 'Persistent bag', 'Demo checkout'],
    palette: ['#2439ed', '#dfff79', '#f5f3eb', '#ff825c'],
    brief: 'Turn this into a synth shop, a material library, or a marketplace for things that haven’t been invented yet.',
    interaction: 'Switch the showroom study. Find a tool. Build a bag.',
  },
  {
    id: 'margin', number: '02', title: 'Margin Notes', category: 'Editorial commerce',
    description: 'An independent bookshop that feels like a beautifully dog-eared journal. Layered editions, oversized type, and new ways to follow your curiosity.',
    tags: ['24 original editions', 'Reading mood finder', 'Saved reading shelf', 'Reading samples'],
    palette: ['#641f34', '#eed69d', '#f3ede1', '#f07958'],
    brief: 'Make it a record store, an independent magazine archive, or a collection of places you want to get lost in.',
    interaction: 'Follow a reading mood. Open a sample. Save a future read.',
  },
] as const

export type FullstackAppId = typeof fullstackApps[number]['id']
