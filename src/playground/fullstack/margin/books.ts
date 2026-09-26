/** Original fictional titles and authors for the Margin Notes demo. Prices in USD cents. */
export interface Book { sku: string; name: string; category: string; price: number; description: string; detail: string; specs: string[]; color: string; badge: string; stock: number; shape: number }
const titles = [
  ['The Quiet Move', 'Elias Voss', 'Fiction', 'A chess restorer discovers that the missing piece in a stranger’s collection is a story from his own childhood.'],
  ['A House for Elsewhere', 'Mira Sol', 'Fiction', 'Three sisters return to a house that seems to remember a different version of their family.'],
  ['Atlas of Small Departures', 'Theo Arden', 'Fiction', 'An overnight railway connects six strangers who are all leaving something unsaid.'],
  ['The Last Green Room', 'Ada Vale', 'Fiction', 'A retiring stage designer builds one final world for a play nobody has written.'],
  ['Weather for Strangers', 'Jonah Reed', 'Fiction', 'On an island without a weather station, a child starts forecasting the lives of the people around her.'],
  ['Before the City Wakes', 'Clara Moss', 'Fiction', 'Two night workers trace a secret map through a city they have never seen by daylight.'],
  ['The Art of Enough', 'Nora Field', 'Essays', 'Thoughts on attention, ordinary abundance, and knowing when to leave a little room.'],
  ['In Praise of Detours', 'Leo Finch', 'Essays', 'A wandering notebook about the places we find when our plans fail us.'],
  ['Notes on Noticing', 'Iris Bell', 'Essays', 'Twenty-four invitations to pay closer attention to what is already here.'],
  ['A Useful Kind of Doubt', 'Sam Rowan', 'Essays', 'On changing your mind, asking better questions, and learning to listen.'],
  ['The Shape of a Day', 'June Hale', 'Essays', 'Small rituals, borrowed hours, and the quiet architecture of everyday life.'],
  ['Against the Hurry', 'Owen Lake', 'Essays', 'An unhurried collection about making space for work that matters.'],
  ['Ways of Seeing Slowly', 'Eva North', 'Design', 'A visual field guide to finding pattern and possibility in ordinary objects.'],
  ['The Unfinished Object', 'Finn Gray', 'Design', 'Sketchbooks, prototypes, and a celebration of things still becoming.'],
  ['A Grammar of Light', 'Lena Park', 'Design', 'Windows, shadows, and the art of arranging a room around the sun.'],
  ['Paper, Fold, Repeat', 'Kit Rivers', 'Design', 'Thirty playful studies in making more from a single sheet.'],
  ['Colour in the Margins', 'Rae Winters', 'Design', 'An unexpected palette book, gathered from walks, markets, and forgotten corners.'],
  ['Objects with a Past', 'Alex Pine', 'Design', 'The stories held by a worn chair, a repaired cup, and a well-used tool.'],
  ['The Space Between Lines', 'Cleo Ash', 'Poetry', 'Poems for the pauses: between seasons, between sentences, between people.'],
  ['Field Notes at Dusk', 'Ren Wilder', 'Poetry', 'A pocket collection of small observations from the edge of the day.'],
  ['Things the Sea Returns', 'Jules Cove', 'Poetry', 'On tides, memory, and the beautiful things we cannot keep.'],
  ['An Alphabet of Rain', 'Wren Ellis', 'Poetry', 'Twenty-six meditations on weather and the language of belonging.'],
  ['Soft Edges', 'Robin Fern', 'Poetry', 'Tender poems about imperfect places and the people who make them home.'],
  ['Every Open Window', 'Milo Sage', 'Poetry', 'A collection about beginning again, written one morning at a time.']
];
const colors = ['#367a62', '#ad694e', '#324954', '#9b914f', '#655775', '#466b70'];
export const books: Book[] = titles.map(([name, author, category, detail], index) => ({
  sku: 'MN-' + String(index + 1).padStart(2, '0'), name, description: author, category, detail,
  price: category === 'Design' ? 3200 + (index % 3) * 400 : category === 'Poetry' ? 1600 + (index % 3) * 200 : 2200 + (index % 3) * 300,
  specs: [index % 3 === 0 ? 'Hardcover' : 'Paperback', (160 + index * 8) + ' pages', 'English', 'Margin Notes · 2026'],
  color: colors[index % colors.length], badge: index === 0 ? 'Book of the month' : index % 5 === 0 ? 'Editor’s pick' : '',
  stock: index === 23 ? 0 : 12 + index, shape: index % 4
}));
