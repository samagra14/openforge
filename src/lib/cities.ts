// Fiction locations and character names used for workspace naming
const NAMES = [
  // Tolkien
  "rivendell","mordor","gondor","rohan","shire","minas-tirith","lothlorien","isengard",
  "helms-deep","fangorn","erebor","moria","aragorn","gandalf","frodo","legolas",
  "gimli","samwise","gollum","elrond","galadriel","eowyn","faramir","boromir",
  "theoden","treebeard",
  // Harry Potter
  "hogwarts","diagon-alley","hogsmeade","azkaban","godrics-hollow","dumbledore",
  "hermione","hagrid","snape","sirius","lupin","dobby","neville","draco",
  "bellatrix","voldemort","mcgonagall",
  // Star Wars
  "tatooine","coruscant","naboo","endor","dagobah","hoth","kashyyyk","alderaan",
  "mustafar","kamino","bespin","jakku","mandalore","yoda","chewbacca","leia",
  "han-solo","obi-wan","ahsoka","padme",
  // Game of Thrones
  "winterfell","kings-landing","dragonstone","highgarden","dorne","braavos",
  "volantis","meereen","casterly-rock","tyrion","cersei","daenerys","arya",
  "sansa","jon-snow","brienne","hodor","missandei",
  // Marvel / DC
  "wakanda","gotham","metropolis","asgard","xandar","knowhere","titan","sakaar",
  "madripoor",
  // Studio Ghibli
  "totoro","howl","chihiro","ashitaka","kiki","ponyo","mononoke","laputa","nausicaa",
  // Disney
  "neverland","agrabah","atlantica","elsa","simba","mulan","merida","moana","maui",
  "stitch",
  // Narnia
  "narnia","cair-paravel","aslan",
  // Dune
  "arrakis","caladan","giedi-prime","paul-atreides","chani","stilgar","leto","duncan",
  // The Witcher
  "geralt","yennefer","ciri","triss","kaer-morhen","novigrad","oxenfurt","skellige",
  // Avatar: The Last Airbender
  "aang","katara","sokka","zuko","toph","iroh","azula","appa","ba-sing-se","omashu",
  // Pokemon
  "pikachu","charizard","mewtwo","eevee","bulbasaur","squirtle",
  // Zelda
  "hyrule","zelda","ganondorf","kakariko","zora","gerudo","kokiri",
  // Anime
  "naruto","goku","luffy","ichigo","tanjiro","midoriya","eren","mikasa","levi",
  "spike-spiegel","edward-elric",
  // Mythology & classic fiction
  "oz","wonderland","camelot","avalon","eldorado","shangri-la","utopia","valhalla",
  "olympus","atlantis","xanadu",
  // Discworld
  "ankh-morpork","rincewind","vimes",
  // Hitchhiker's Guide
  "zaphod","marvin","trillian","magrathea",
  // Nintendo & games
  "mario","luigi","peach","bowser","link","samus","kirby","sonic",
  // Final Fantasy
  "cloud-strife","tifa","aerith","sephiroth","midgar","zanarkand",
  // Sci-fi
  "pandora","cybertron","krypton","vulcan","bajor","trantor","rapture",
];

export function getRandomName(exclude: string[] = []): string {
  const available = NAMES.filter((c) => !exclude.includes(c));
  if (available.length === 0) {
    return `workspace-${Math.random().toString(36).slice(2, 10)}`;
  }
  return available[Math.floor(Math.random() * available.length)];
}

export { NAMES };

// Backwards compat
export const CITIES = NAMES;
export const getRandomCity = getRandomName;
