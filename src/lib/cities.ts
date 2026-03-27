const CITIES = [
  "tokyo","mumbai","lagos","rio-de-janeiro","paris","new-york","seoul","istanbul",
  "cairo","buenos-aires","nairobi","bangkok","toronto","sydney","berlin","dubai",
  "singapore","jakarta","moscow","lima","bogota","delhi","chennai","bangalore",
  "hyderabad","kolkata","pune","ahmedabad","jaipur","lucknow","london","madrid",
  "rome","amsterdam","prague","vienna","zurich","oslo","stockholm","helsinki",
  "copenhagen","dublin","lisbon","athens","warsaw","budapest","bucharest","sofia",
  "belgrade","zagreb","bratislava","taipei","hong-kong","shanghai","beijing",
  "guangzhou","shenzhen","osaka","kyoto","nagoya","sapporo","hanoi","ho-chi-minh",
  "manila","kuala-lumpur","yangon","dhaka","karachi","lahore","islamabad","tehran",
  "baghdad","riyadh","doha","muscat","amman","beirut","jerusalem","tel-aviv",
  "cape-town","johannesburg","casablanca","tunis","algiers","accra","dakar",
  "addis-ababa","kampala","dar-es-salaam","maputo","lusaka","harare","mexico-city",
  "guadalajara","monterrey","havana","san-jose","panama-city","quito","santiago",
  "montevideo","asuncion","la-paz","caracas","medellin","vancouver","montreal",
  "calgary","ottawa","chicago","san-francisco","los-angeles","seattle","austin",
  "denver","miami","boston","portland","detroit","atlanta","phoenix","houston",
  "dallas","philadelphia","minneapolis","nashville","new-orleans","salt-lake-city",
  "pittsburgh","auckland","wellington","melbourne","brisbane","perth","honolulu",
  "reykjavik","tallinn","riga","vilnius","tbilisi","yerevan","baku","tashkent",
  "almaty","ulaanbaatar","kathmandu","colombo","kochi","goa","varanasi","indore",
  "surat","nagpur","bhopal","chandigarh","coimbatore","mysore","vizag","patna",
  "ranchi","raipur","guwahati","shimla","dehradun","rishikesh","udaipur","jodhpur",
  "agra","kanpur","amritsar","florence","barcelona","munich","hamburg","lyon",
  "marseille","milan","naples","porto","seville","malaga","edinburgh","glasgow",
  "manchester","birmingham","brussels","antwerp","rotterdam","gothenburg","bergen",
  "krakow","gdansk","split","dubrovnik","santorini",
];

export function getRandomCity(exclude: string[] = []): string {
  const available = CITIES.filter((c) => !exclude.includes(c));
  if (available.length === 0) {
    return `workspace-${Math.random().toString(36).slice(2, 10)}`;
  }
  return available[Math.floor(Math.random() * available.length)];
}

export { CITIES };
