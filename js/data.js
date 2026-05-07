/**
 * Trip data for Maine & Maritime 2026.
 * Travelers: Steve, Carey (iPhone), Brad (Android).
 * Dates: 2026-05-22 → 2026-06-06 (15 nights, 16 days).
 *
 * Exposed as window.TRIP. Tabs read from this object for display.
 * Mutable runtime state (e.g. day completion, ad-hoc expenses)
 * is layered on top in localStorage by app.js — not stored here.
 */
window.TRIP = {

  meta: {
    title: 'Maine & Maritime 2026',
    startDate: '2026-05-22',
    endDate: '2026-06-06',
    nights: 15,
    days: 16,
    travelers: [
      { name: 'Steve', device: null },
      { name: 'Carey', device: 'iPhone' },
      { name: 'Brad',  device: 'Android' }
    ],
    cadToUsd: 1.38,
    route: [
      'Portland, ME',
      'Bar Harbor, ME',
      'St. Andrews, NB',
      'Charlottetown, PEI',
      'Baddeck, NS',
      'Lunenburg, NS',
      'Bar Harbor, ME (CAT Ferry return)',
      'Portland, ME'
    ]
  },

  days: [
    {
      dayNum: 1,
      date: '2026-05-22',
      dateDisplay: 'Friday, May 22',
      title: 'Arrival — Portland, Maine',
      location: 'Portland, ME',
      driving: null,
      hotel: 'AC Hotel Portland',
      highlights: [
        'Arrival night — first impressions of Portland',
        'Old Port quick stroll if energy allows'
      ],
      meals: [],
      logistics: [
        'Steve & Carey: Delta 1241 ATL→PWM, depart 8:32pm, arrive 11:09pm (seat 03C First, conf JM4VI6)',
        'Brad: United IAH→ORD→PWM, arrives 9:51pm (conf INMW92)',
        'Avis pickup ~11pm at PWM — Jeep Grand Cherokee L (conf 10055155US5). Have confirmation # ready; counter closes late.',
        'Late check-in at AC Hotel Portland'
      ]
    },
    {
      dayNum: 2,
      date: '2026-05-23',
      dateDisplay: 'Saturday, May 23',
      title: 'Portland',
      location: 'Portland, ME',
      driving: null,
      hotel: 'AC Hotel Portland',
      highlights: [
        'Portland Head Light (Cape Elizabeth)',
        'Eastern Promenade walk',
        'Old Port wandering',
        'Congress Street arts district'
      ],
      meals: [
        'Lunch: Eventide Oyster Co.',
        'Dinner: Fore Street, 7:00pm — 288 Fore St, (207) 775-2717, conf 2110326994 (seats complete parties only, 15-min grace)'
      ],
      logistics: [
        'Hotel cancellation deadline (May 20) has passed — no action needed'
      ]
    },
    {
      dayNum: 3,
      date: '2026-05-24',
      dateDisplay: 'Sunday, May 24',
      title: 'Portland → Bar Harbor',
      location: 'Bar Harbor, ME',
      driving: '~3.5 hrs Portland → Bar Harbor',
      hotel: 'Bass Cottage & Ullikana',
      highlights: [
        'Acadia scenic entry into Mount Desert Island',
        'Bar Harbor waterfront stroll',
        'Havana restaurant for dinner if available'
      ],
      meals: [],
      logistics: [
        'BOOK Cadillac Mountain vehicle reservation TODAY at 10:00am ET on recreation.gov ($6/vehicle, for May 26 summit visit)',
        'Check out AC Hotel Portland in the morning',
        'Bass Cottage check-in after 3pm — Forget-me-not room (conf 31562645, 3 nights)',
        '$848.02 USD balance due at Bass Cottage checkout on May 27'
      ]
    },
    {
      dayNum: 4,
      date: '2026-05-25',
      dateDisplay: 'Monday, May 25',
      title: 'Acadia — Schoodic Peninsula',
      location: 'Bar Harbor, ME',
      driving: '~1 hr each way to Schoodic',
      hotel: 'Bass Cottage & Ullikana',
      highlights: [
        'Schoodic Peninsula loop — least crowded part of Acadia',
        'Frazer Point picnic area',
        'Rocky coastline viewpoints',
        'Winter Harbor village'
      ],
      meals: [],
      logistics: [
        'Pay $35 USD vehicle fee at Acadia gate — covers Days 4 & 5 (no America the Beautiful pass needed)'
      ]
    },
    {
      dayNum: 5,
      date: '2026-05-26',
      dateDisplay: 'Tuesday, May 26',
      title: 'Acadia — Main MDI Side',
      location: 'Bar Harbor, ME',
      driving: 'In-park drives only',
      hotel: 'Bass Cottage & Ullikana',
      highlights: [
        'Jordan Pond House — popovers and tea',
        'Thunder Hole',
        'Sand Beach',
        'Ocean Path coastal walk',
        'Cadillac Mountain summit (afternoon)'
      ],
      meals: [],
      logistics: [
        'Cadillac Mountain vehicle reservation REQUIRED — book on recreation.gov on May 24 (2 days prior, opens 10am ET), $6/vehicle'
      ]
    },
    {
      dayNum: 6,
      date: '2026-05-27',
      dateDisplay: 'Wednesday, May 27',
      title: "Bar Harbor → New Harbor → St. Andrews NB — Carey's Birthday",
      location: 'St. Andrews, NB',
      driving: '~3.5 hrs after Hardy Boat cruise (includes border crossing)',
      hotel: 'Algonquin Resort',
      highlights: [
        'Hardy Boat Puffin Cruise — noon departure from New Harbor',
        'Border crossing into New Brunswick',
        "Carey's birthday dinner at Braxton's at the Algonquin"
      ],
      meals: [
        "Dinner: Braxton's at the Algonquin (mention birthday at check-in)"
      ],
      logistics: [
        'Check out Bass Cottage — $848.02 USD balance due',
        'Hardy Boat: arrive at 89 State Route 32, New Harbor ME by 11:15am for noon departure (conf FLBQXT, no refunds)',
        'Border crossing: passports ready, declare any food/alcohol',
        'Algonquin check-in 4pm (conf 72157352, 2 nights)',
        'New Brunswick stays on Eastern Time — no clock change yet'
      ]
    },
    {
      dayNum: 7,
      date: '2026-05-28',
      dateDisplay: 'Thursday, May 28',
      title: 'St. Andrews NB',
      location: 'St. Andrews, NB',
      driving: 'Local only',
      hotel: 'Algonquin Resort',
      highlights: [
        "Ministers Island via tidal causeway (low tide only — check times)",
        'Kingsbrae Garden',
        'St. Andrews waterfront',
        'Whale watching (optional add-on)'
      ],
      meals: [
        'Dinner: Rossmount Inn, 7:30pm — party of 3, +1-506-529-3351, ~10 min from Algonquin'
      ],
      logistics: [
        "Ministers Island only accessible at low tide — confirm day-of schedule"
      ]
    },
    {
      dayNum: 8,
      date: '2026-05-29',
      dateDisplay: 'Friday, May 29',
      title: 'St. Andrews → Hopewell Rocks → Charlottetown PEI',
      location: 'Charlottetown, PEI',
      driving: '~3.5 hrs + Hopewell Rocks stop',
      hotel: 'Delta Hotels PEI',
      highlights: [
        'Hopewell Rocks ocean floor walk (NB Provincial Park)',
        'Confederation Bridge crossing into PEI',
        'Charlottetown evening arrival'
      ],
      meals: [],
      logistics: [
        'Check out Algonquin in the morning',
        'Hopewell Rocks: separate provincial gate admission (NOT covered by Parks Canada pass) — aim for low tide for floor walk',
        'TIME CHANGE on entering PEI: +1 hour to Atlantic Time. Set phones to auto time zone.',
        'Delta Hotels PEI check-in (conf 72167398, 3 nights)'
      ]
    },
    {
      dayNum: 9,
      date: '2026-05-30',
      dateDisplay: 'Saturday, May 30',
      title: 'Charlottetown & PEI National Park',
      location: 'Charlottetown, PEI',
      driving: '~30 min to Cavendish',
      hotel: 'Delta Hotels PEI',
      highlights: [
        'PEI National Park: Cavendish Beach, red sand dunes',
        'Green Gables Heritage Place',
        'Charlottetown historic district',
        'Province House National Historic Site'
      ],
      meals: [],
      logistics: [
        'BUY Parks Canada Family/Group Discovery Pass at PEI National Park gate — CAD $167.50, covers all 3 in vehicle for all Canadian national parks. No advance purchase needed.',
        'Good day for laundry — Delta has complimentary guest laundromat + valet laundry on site'
      ]
    },
    {
      dayNum: 10,
      date: '2026-05-31',
      dateDisplay: 'Sunday, May 31',
      title: 'PEI → Wood Islands Ferry → Baddeck NS',
      location: 'Baddeck, NS',
      driving: '~2.5 hrs Caribou NS → Baddeck (after 75-min ferry)',
      hotel: 'Inverary Resort Baddeck',
      highlights: [
        'Wood Islands → Caribou ferry crossing (75 min)',
        'Drive into Cape Breton',
        'Baddeck waterfront arrival'
      ],
      meals: [],
      logistics: [
        'Check out Delta Hotels PEI in the morning',
        'Wood Islands Ferry: 23 Service Road, Wood Islands PEI. Check in by 9:20am AT (firm), departs 10:00am AT (conf 2427722).',
        'Inverary Resort check-in (conf 484158, 3 nights)'
      ]
    },
    {
      dayNum: 11,
      date: '2026-06-01',
      dateDisplay: 'Monday, June 1',
      title: 'Baddeck & Cape Breton',
      location: 'Baddeck, NS',
      driving: 'Local only',
      hotel: 'Inverary Resort Baddeck',
      highlights: [
        'Alexander Graham Bell National Historic Site',
        'Baddeck waterfront and sailing',
        'Cape Breton scenery'
      ],
      meals: [],
      logistics: [
        'Parks Canada Discovery Pass covers Bell NHS entry'
      ]
    },
    {
      dayNum: 12,
      date: '2026-06-02',
      dateDisplay: 'Tuesday, June 2',
      title: 'Cabot Trail Private Tour',
      location: 'Cape Breton, NS',
      driving: 'Full day with guide (no driving for us)',
      hotel: 'Inverary Resort Baddeck',
      highlights: [
        'Skyline Trail (no timed entry needed — reservation system starts June 26)',
        'Cape Breton Highlands National Park',
        'Coastal views and pull-offs',
        'Moose spotting opportunities'
      ],
      meals: [],
      logistics: [
        'Cabot Discovery Tours private tour — pickup at Inverary 9am (conf NDTN-230326, CAD $774.00)',
        'Cancel 48+ hrs prior if needed',
        'No Skyline Trail parking reservation needed for June 2',
        'Wear layers — full day, variable weather'
      ]
    },
    {
      dayNum: 13,
      date: '2026-06-03',
      dateDisplay: 'Wednesday, June 3',
      title: 'Cape Breton Flex Day',
      location: 'Baddeck, NS',
      driving: 'Depends on option chosen',
      hotel: 'Inverary Resort Baddeck',
      highlights: [
        'Option A: Ingonish & Middle Head Trail',
        'Option B: Fortress of Louisbourg NHS (Parks Canada pass covers entry)',
        'Option C: Baddeck rest day',
        'Last full day in Cape Breton — choose your adventure'
      ],
      meals: [],
      logistics: []
    },
    {
      dayNum: 14,
      date: '2026-06-04',
      dateDisplay: 'Thursday, June 4',
      title: 'Baddeck → Lunenburg NS',
      location: 'Lunenburg, NS',
      driving: '~3 hrs via Hwy 104 then Hwy 103',
      hotel: 'Rum Runner Inn Lunenburg',
      highlights: [
        'UNESCO World Heritage Old Town Lunenburg',
        'Fisheries Museum of the Atlantic',
        'Bluenose II (if in port)',
        'Painted historic waterfront buildings'
      ],
      meals: [
        'Dinner: Beach Pea Kitchen & Bar, 7:00pm — 128 Montague St, (902) 640-3474, conf 42900 (15-min grace)'
      ],
      logistics: [
        'Check out Inverary in the morning',
        'Rum Runner Inn check-in 4pm — Oceanfront Honeymoon King Room with Balcony (conf 6271986405929)',
        'Rum Runner: VISA or MASTERCARD ONLY — no Amex',
        'Rum Runner contact: 1-902-634-9200 / info@rumrunnerinn.com'
      ]
    },
    {
      dayNum: 15,
      date: '2026-06-05',
      dateDisplay: 'Friday, June 5',
      title: 'Lunenburg → Yarmouth → Bar Harbor → Portland',
      location: 'Portland, ME',
      driving: '~1 hr 15 min Lunenburg → Yarmouth, then 3.5 hr ferry, then ~3.5 hrs Bar Harbor → Portland',
      hotel: 'AC Hotel Portland',
      highlights: [
        'CAT Ferry crossing Yarmouth → Bar Harbor',
        'Return to Maine',
        'Final Portland evening'
      ],
      meals: [],
      logistics: [
        'Check out Rum Runner Inn by 7:00am',
        'Leave Lunenburg ~7:00am — Yarmouth ~1hr 15min away',
        'CAT Ferry: check in by 8:30am AT, departs 9:30am AT (conf 2426628). 3.5-hr crossing.',
        'TIME CHANGE on arrival in Bar Harbor — back to Eastern Time',
        'AC Hotel Portland return check-in (conf 72341164, 1 night)'
      ]
    },
    {
      dayNum: 16,
      date: '2026-06-06',
      dateDisplay: 'Saturday, June 6',
      title: 'Fly Home',
      location: 'Portland, ME → home',
      driving: 'Avis return at PWM',
      hotel: null,
      highlights: [
        'Trip complete — safe travels home'
      ],
      meals: [],
      logistics: [
        'Check out AC Hotel Portland by 4:30am',
        'Return Avis at PWM before 5:00am (well before flights)',
        'Steve & Carey: Delta 1515 PWM→ATL, depart 6:00am, arrive 9:00am (seat 03B First, conf JM4VI6)',
        'Brad: United UA 723 PWM→ORD depart 6:00am, UA 535 ORD→IAH depart 8:51am (conf INMW92)',
        'EARLY departure — set multiple alarms'
      ]
    }
  ],

  bookings: [
    {
      id: 'delta-out',
      category: 'flight',
      name: 'Delta 1241 — ATL → PWM (Steve & Carey)',
      conf: 'JM4VI6',
      date: '2026-05-22',
      details: 'Depart 8:32pm ATL, arrive 11:09pm PWM. Seat 03C First.',
      amount: '$30.80 USD',
      phone: null,
      payment: null
    },
    {
      id: 'ac-portland-1',
      category: 'hotel',
      name: 'AC Hotel Portland (arrival stay, 2 nights)',
      conf: '72043738',
      date: '2026-05-22',
      details: 'May 22–24, 2 nights. Cancellation deadline May 20 (passed).',
      amount: '$774.45 USD',
      phone: null,
      payment: null
    },
    {
      id: 'bass-cottage',
      category: 'hotel',
      name: 'Bass Cottage & Ullikana, Bar Harbor (3 nights)',
      conf: '31562645',
      date: '2026-05-24',
      details: 'May 24–27, Forget-me-not room. $848.02 USD balance due at checkout May 27.',
      amount: '$1,359.23 USD',
      phone: null,
      payment: null
    },
    {
      id: 'hardy-boat',
      category: 'activity',
      name: 'Hardy Boat Puffin Cruise, New Harbor ME',
      conf: 'FLBQXT',
      date: '2026-05-27',
      details: 'Noon departure. Arrive 89 State Route 32, New Harbor ME by 11:15am. NO REFUNDS.',
      amount: '$206.70 USD',
      phone: '(207) 677-2026',
      payment: null
    },
    {
      id: 'algonquin',
      category: 'hotel',
      name: 'Algonquin Resort, St. Andrews NB (2 nights)',
      conf: '72157352',
      date: '2026-05-27',
      details: 'May 27–29, check-in 4pm. Cancellation deadline May 24.',
      amount: 'CAD $935.33',
      phone: null,
      payment: null
    },
    {
      id: 'delta-pei',
      category: 'hotel',
      name: 'Delta Hotels PEI, Charlottetown (3 nights)',
      conf: '72167398',
      date: '2026-05-29',
      details: 'May 29–Jun 1. Cancellation deadline May 26. On-site laundry available.',
      amount: 'CAD $1,425.64',
      phone: null,
      payment: null
    },
    {
      id: 'wood-islands-ferry',
      category: 'ferry',
      name: 'Wood Islands → Caribou Ferry (Northumberland)',
      conf: '2427722',
      date: '2026-05-31',
      details: '23 Service Road, Wood Islands PEI. Check in by 9:20am AT, departs 10:00am AT. 75-min crossing.',
      amount: 'CAD $45.50',
      phone: '1-877-359-3760',
      payment: null
    },
    {
      id: 'inverary',
      category: 'hotel',
      name: 'Inverary Resort, Baddeck NS (3 nights)',
      conf: '484158',
      date: '2026-05-31',
      details: 'May 31–Jun 4. Cape Breton base.',
      amount: 'CAD $1,056.15',
      phone: null,
      payment: null
    },
    {
      id: 'cabot-discovery',
      category: 'activity',
      name: 'Cabot Discovery Tours — Cabot Trail private tour',
      conf: 'NDTN-230326',
      date: '2026-06-02',
      details: 'Pickup Inverary 9am. Cancellation 48+ hrs prior.',
      amount: 'CAD $774.00',
      phone: null,
      payment: null
    },
    {
      id: 'rum-runner',
      category: 'hotel',
      name: 'Rum Runner Inn, Lunenburg NS (1 night)',
      conf: '6271986405929',
      date: '2026-06-04',
      details: 'Oceanfront Honeymoon King Room with Balcony. Check-in 4pm, check-out 11am. Cancellation by May 30 4pm AT.',
      amount: 'CAD $225.72',
      phone: '1-902-634-9200',
      payment: 'Visa/MC only — no Amex'
    },
    {
      id: 'cat-ferry',
      category: 'ferry',
      name: 'CAT Ferry Yarmouth NS → Bar Harbor ME',
      conf: '2426628',
      date: '2026-06-05',
      details: 'Check in by 8:30am AT, departs 9:30am AT. 3.5-hr crossing.',
      amount: '$364.50 USD',
      phone: null,
      payment: null
    },
    {
      id: 'ac-portland-2',
      category: 'hotel',
      name: 'AC Hotel Portland (return stay, 1 night)',
      conf: '72341164',
      date: '2026-06-05',
      details: 'Jun 5–6. Cancellation deadline Jun 3.',
      amount: '$487.91 USD',
      phone: null,
      payment: null
    },
    {
      id: 'delta-return',
      category: 'flight',
      name: 'Delta 1515 — PWM → ATL (Steve & Carey)',
      conf: 'JM4VI6',
      date: '2026-06-06',
      details: 'Depart 6:00am PWM, arrive 9:00am ATL. Seat 03B First.',
      amount: 'Included in JM4VI6',
      phone: null,
      payment: null
    },
    {
      id: 'avis',
      category: 'transport',
      name: 'Avis Rental Car — Jeep Grand Cherokee L',
      conf: '10055155US5',
      date: '2026-05-22',
      details: 'Pickup PWM ~11pm May 22, return PWM by 5:00am Jun 6. Canada use confirmed.',
      amount: 'est $1,159.28 USD',
      phone: '(207) 874-7500',
      payment: 'Visa/MC only — no Amex'
    },
    {
      id: 'united-out',
      category: 'flight',
      name: 'United IAH → ORD → PWM (Brad)',
      conf: 'INMW92',
      date: '2026-05-22',
      details: 'UA 2827 IAH→ORD depart 2:37pm arrive 5:33pm. UA 1401 ORD→PWM depart 6:18pm arrive 9:51pm.',
      amount: 'Tracked by Brad',
      phone: null,
      payment: null
    },
    {
      id: 'united-return',
      category: 'flight',
      name: 'United PWM → ORD → IAH (Brad)',
      conf: 'INMW92',
      date: '2026-06-06',
      details: 'UA 723 PWM→ORD depart 6:00am. UA 535 ORD→IAH depart 8:51am.',
      amount: 'Tracked by Brad',
      phone: null,
      payment: null
    }
  ],

  dining: [
    {
      id: 'fore-street',
      name: 'Fore Street',
      city: 'Portland, ME',
      date: '2026-05-23',
      time: '7:00pm',
      conf: '2110326994',
      phone: '(207) 775-2717',
      address: '288 Fore St',
      notes: 'Seats complete parties only — 15-min grace period.'
    },
    {
      id: 'rossmount-inn',
      name: 'Rossmount Inn',
      city: 'St. Andrews, NB',
      date: '2026-05-28',
      time: '7:30pm',
      conf: null,
      phone: '+1-506-529-3351',
      address: null,
      notes: 'Party of 3. ~10 min from Algonquin Resort.'
    },
    {
      id: 'beach-pea',
      name: 'Beach Pea Kitchen & Bar',
      city: 'Lunenburg, NS',
      date: '2026-06-04',
      time: '7:00pm',
      conf: '42900',
      phone: '(902) 640-3474',
      address: '128 Montague St',
      notes: '15-min grace period.'
    }
  ],

  expenses: [
    {
      id: 'exp-ac-portland-1',
      date: '2026-05-22',
      description: 'AC Hotel Portland — arrival stay (2 nights)',
      amount: 774.45,
      currency: 'USD',
      originalAmount: 774.45,
      category: 'SC_ONLY',
      preloaded: true
    },
    {
      id: 'exp-bass-cottage',
      date: '2026-05-24',
      description: 'Bass Cottage & Ullikana — Bar Harbor (3 nights)',
      amount: 1359.23,
      currency: 'USD',
      originalAmount: 1359.23,
      category: 'SC_ONLY',
      preloaded: true
    },
    {
      id: 'exp-delta-flights',
      date: '2026-05-22',
      description: 'Delta flights — Steve & Carey (round trip JM4VI6)',
      amount: 30.80,
      currency: 'USD',
      originalAmount: 30.80,
      category: 'SC_ONLY',
      preloaded: true
    },
    {
      id: 'exp-hardy-boat',
      date: '2026-05-27',
      description: 'Hardy Boat Puffin Cruise',
      amount: 206.70,
      currency: 'USD',
      originalAmount: 206.70,
      category: 'SPLIT_3',
      preloaded: true
    },
    {
      id: 'exp-algonquin',
      date: '2026-05-27',
      description: 'Algonquin Resort, St. Andrews NB (2 nights)',
      amount: 677.78,
      currency: 'CAD',
      originalAmount: 935.33,
      category: 'SC_ONLY',
      preloaded: true
    },
    {
      id: 'exp-delta-pei',
      date: '2026-05-29',
      description: 'Delta Hotels PEI, Charlottetown (3 nights)',
      amount: 1033.07,
      currency: 'CAD',
      originalAmount: 1425.64,
      category: 'SC_ONLY',
      preloaded: true
    },
    {
      id: 'exp-wood-islands',
      date: '2026-05-31',
      description: 'Wood Islands → Caribou Ferry',
      amount: 32.97,
      currency: 'CAD',
      originalAmount: 45.50,
      category: 'SPLIT_3',
      preloaded: true
    },
    {
      id: 'exp-inverary',
      date: '2026-05-31',
      description: 'Inverary Resort, Baddeck NS (3 nights)',
      amount: 765.33,
      currency: 'CAD',
      originalAmount: 1056.15,
      category: 'SC_ONLY',
      preloaded: true
    },
    {
      id: 'exp-cabot-discovery',
      date: '2026-06-02',
      description: 'Cabot Discovery Tours — Cabot Trail private tour',
      amount: 560.87,
      currency: 'CAD',
      originalAmount: 774.00,
      category: 'SPLIT_3',
      preloaded: true
    },
    {
      id: 'exp-rum-runner',
      date: '2026-06-04',
      description: 'Rum Runner Inn, Lunenburg NS (1 night)',
      amount: 163.57,
      currency: 'CAD',
      originalAmount: 225.72,
      category: 'SC_ONLY',
      preloaded: true
    },
    {
      id: 'exp-cat-ferry',
      date: '2026-06-05',
      description: 'CAT Ferry Yarmouth → Bar Harbor',
      amount: 364.50,
      currency: 'USD',
      originalAmount: 364.50,
      category: 'SPLIT_3',
      preloaded: true
    },
    {
      id: 'exp-ac-portland-2',
      date: '2026-06-05',
      description: 'AC Hotel Portland — return stay (1 night)',
      amount: 487.91,
      currency: 'USD',
      originalAmount: 487.91,
      category: 'SC_ONLY',
      preloaded: true
    },
    {
      id: 'exp-avis',
      date: '2026-05-22',
      description: 'Avis Rental Car — Jeep Grand Cherokee L (May 22 – Jun 6)',
      amount: 1159.28,
      currency: 'USD',
      originalAmount: 1159.28,
      category: 'SPLIT_3',
      preloaded: true
    }
  ],

  info: {
    currency: {
      cadToUsd: 1.38,
      note: '1 USD ≈ 1.38 CAD. Used to convert CAD expenses to USD-equivalent for the running total.'
    },
    timeZones: {
      easternRegions: ['Maine', 'New Brunswick'],
      atlanticRegions: ['Prince Edward Island', 'Nova Scotia'],
      changeForward: '2026-05-29 — crossing Confederation Bridge into PEI: +1 hour to Atlantic Time.',
      changeBack: '2026-06-05 — arriving Bar Harbor on CAT Ferry: back to Eastern Time.'
    },
    emergency: {
      universal: '911 (US and Canada)',
      avisPwm: '(207) 874-7500',
      northumberlandFerries: '1-877-359-3760',
      parksCanada: '1-888-773-8888',
      rumRunnerInn: '1-902-634-9200',
      hardyBoat: '(207) 677-2026',
      foreStreet: '(207) 775-2717',
      beachPea: '(902) 640-3474',
      rossmountInn: '+1-506-529-3351'
    },
    payment: {
      noAmex: ['Rum Runner Inn (Lunenburg)', 'Avis Rental Car'],
      note: 'Carry a Visa or Mastercard for the no-Amex properties above.'
    },
    border: {
      passportsRequired: true,
      note: 'Passports required for Canada entry. Have ready at border. Declare any food, alcohol, or tobacco.'
    },
    parkPasses: {
      acadiaVehicleFee: {
        amount: '$35 USD',
        when: 'Pay at Acadia gate on Day 4 (May 25)',
        coverage: 'Covers Days 4 & 5 (May 25–26). No America the Beautiful pass needed.'
      },
      cadillacMountain: {
        amount: '$6/vehicle',
        when: 'Book on recreation.gov on May 24 (2 days prior to May 26 visit, opens 10am ET)',
        required: true
      },
      hopewellRocks: {
        coverage: 'Separate NB Provincial Park gate admission — NOT covered by Parks Canada Discovery Pass.'
      },
      parksCanadaDiscovery: {
        type: 'Family/Group Discovery Pass',
        amount: 'CAD $167.50',
        when: 'Buy at PEI National Park gate on May 30',
        coverage: 'All 3 travelers in vehicle, all Canadian national parks for the trip.'
      }
    },
    wifi: {
      bassCottage: 'Ask at check-in',
      algonquin: 'Standard guest WiFi',
      deltaPei: 'Standard guest WiFi',
      inverary: 'Ask at check-in',
      rumRunner: 'Ask at check-in',
      acPortland: 'Standard guest WiFi'
    },
    keyDeadlines: [
      {
        date: '2026-05-24',
        title: 'Cadillac Mountain reservation',
        action: 'Book at recreation.gov at 10:00am ET. $6/vehicle. For May 26 summit visit.'
      },
      {
        date: '2026-05-25',
        title: 'Acadia vehicle fee',
        action: 'Pay $35 USD at gate (Day 4). Covers Days 4 & 5. No America the Beautiful pass needed.'
      },
      {
        date: '2026-05-29',
        title: 'Hopewell Rocks gate admission',
        action: 'Separate NB provincial gate fee at park entry (Day 8). NOT covered by Parks Canada Discovery Pass. Aim for low tide for floor walk.'
      },
      {
        date: '2026-05-30',
        title: 'Parks Canada Discovery Pass',
        action: 'Buy at PEI National Park gate (Day 9). CAD $167.50 Family/Group. Covers all 3 in vehicle for the trip.'
      },
      {
        date: '2026-05-30',
        title: 'Rum Runner Inn cancellation deadline',
        action: 'Cancel by 4:00pm AT for Jun 4 stay. Visa/MC only — no Amex.'
      }
    ],

    laundry: {
      bestStop: 'Delta Hotels PEI',
      nights: 'Nights 8 – 10',
      detail: 'Complimentary guest laundromat on site, plus valet laundry service. Best laundry stop of the trip — roughly the midpoint.'
    }
  }

};
