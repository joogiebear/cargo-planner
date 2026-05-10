// Sample fine-arts shipping data
window.CP_DATA = (() => {
  const facilities = [
    { id: 'f-bk', code: 'BK', name: 'Brooklyn Navy Yard', city: 'New York, NY', address: '63 Flushing Ave', users: 14, trucks: 6 },
    { id: 'f-lic', code: 'LIC', name: 'Long Island City Vault', city: 'Queens, NY', address: '47-12 Austel Pl', users: 8, trucks: 3 },
    { id: 'f-la',  code: 'LA',  name: 'Vernon Climate Vault',  city: 'Vernon, CA',     address: '4980 District Blvd', users: 11, trucks: 5 },
    { id: 'f-ldn', code: 'LDN', name: 'Park Royal Annex',      city: 'London, UK',     address: 'Premier Park Rd',   users: 6,  trucks: 3 },
  ];

  const trucks = [
    // facility, ref, model, L W H (inches), maxLbs
    { id: 't-1', facility: 'f-bk', ref: 'BK-04', model: 'Sprinter 3500',  type: 'Sprinter Van',  L: 170, W: 70,  H: 79,  maxLbs: 4500,  axles: 2 },
    { id: 't-2', facility: 'f-bk', ref: 'BK-11', model: 'Hino 268 Box',   type: '26\u2032 Box',  L: 312, W: 98,  H: 102, maxLbs: 13000, axles: 2 },
    { id: 't-3', facility: 'f-bk', ref: 'BK-22', model: 'Volvo VNL 53\u2032', type: '53\u2032 Trailer', L: 636, W: 100, H: 110, maxLbs: 44000, axles: 5 },
    { id: 't-4', facility: 'f-lic',code: 'LIC', ref: 'LIC-02', model: 'Freightliner M2 24\u2032', type: '24\u2032 Box', L: 288, W: 96, H: 96, maxLbs: 11000, axles: 2 },
    { id: 't-5', facility: 'f-la', ref: 'LA-07', model: 'Kenworth T680 53\u2032', type: '53\u2032 Trailer', L: 636, W: 100, H: 110, maxLbs: 44000, axles: 5 },
    { id: 't-6', facility: 'f-ldn',ref: 'LDN-01', model: 'Mercedes Atego 18t', type: '24\u2032 Box (EU)', L: 280, W: 96, H: 100, maxLbs: 17600, axles: 2 },
  ];

  // dims in inches, weight in lbs
  // mediums: PNT (paint), SCL (sculpt), WRK (work on paper), MIX (installation), DEC (decorative arts), PHT (photo)
  const items = [
    // flags: fragile (handle care), orient ('UP' = this side up; 'ANY'), stack (can have crates on top),
    //        flat (must lie flat, e.g. textile, works on paper bundles), glass (must ride along a side wall, long edge ‖ truck length)
    { id:'i-01', ref:'CRT-9412', title:'Untitled (Marine)',    artist:'Eluardo Reyes', year:1962, medium:'PNT', L:74, W:8,  H:58, lbs:142, fragile:true,  orient:'UP', stack:false, flat:false, glass:false, value:480000, status:'queued' },
    { id:'i-02', ref:'CRT-9413', title:'Form III (bronze)',    artist:'M. Andersen',   year:1979, medium:'SCL', L:42, W:42, H:66, lbs:610, fragile:true,  orient:'UP', stack:false, flat:false, glass:false, value:920000, status:'queued' },
    { id:'i-03', ref:'CRT-9414', title:'Diptych no. 4 (glass)',artist:'L. Okafor',     year:2004, medium:'PNT', L:96, W:6,  H:72, lbs:215, fragile:true,  orient:'UP', stack:false, flat:false, glass:true,  value:165000, status:'queued' },
    { id:'i-04', ref:'CRT-9415', title:'Vessel, c.1820',       artist:'Anonymous',     year:1820, medium:'DEC', L:24, W:24, H:32, lbs:88,  fragile:true,  orient:'UP', stack:false, flat:false, glass:false, value:54000,  status:'queued' },
    { id:'i-05', ref:'CRT-9416', title:'Library of Glass',     artist:'R. Kawamura',   year:2018, medium:'MIX', L:60, W:60, H:84, lbs:780, fragile:true,  orient:'UP', stack:false, flat:false, glass:true,  value:1200000,status:'queued' },
    { id:'i-06', ref:'CRT-9417', title:'Six Studies',          artist:'F. Bellori',    year:1996, medium:'WRK', L:48, W:4,  H:36, lbs:38,  fragile:true,  orient:'UP', stack:true,  flat:true,  glass:false, value:24000,  status:'queued' },
    { id:'i-07', ref:'CRT-9418', title:'Field Recording (II)', artist:'A. Park',       year:2011, medium:'PHT', L:54, W:4,  H:42, lbs:45,  fragile:true,  orient:'UP', stack:true,  flat:false, glass:false, value:32000,  status:'queued' },
    { id:'i-08', ref:'CRT-9419', title:'Black Mountain Studies',artist:'C. Whitfield', year:1957, medium:'WRK', L:36, W:3,  H:28, lbs:22,  fragile:true,  orient:'UP', stack:true,  flat:true,  glass:false, value:18000,  status:'queued' },
    { id:'i-09', ref:'CRT-9420', title:'Plinth, white oak',    artist:'\u2014',        year:2024, medium:'MIX', L:48, W:24, H:42, lbs:140, fragile:false, orient:'ANY',stack:true,  flat:false, glass:false, value:0,      status:'queued' },
    { id:'i-10', ref:'CRT-9421', title:'Crate, archival foam', artist:'\u2014',        year:2024, medium:'MIX', L:60, W:36, H:36, lbs:65,  fragile:false, orient:'ANY',stack:true,  flat:false, glass:false, value:0,      status:'queued' },
    { id:'i-11', ref:'CRT-9422', title:'Allegory (after Lotto)',artist:'P. Sarmento',  year:1988, medium:'PNT', L:72, W:6,  H:54, lbs:120, fragile:true,  orient:'UP', stack:false, flat:false, glass:false, value:215000, status:'queued' },
    { id:'i-12', ref:'CRT-9423', title:'Maquette \u2014 Pavilion',artist:'M. Andersen',year:1981, medium:'SCL', L:36, W:36, H:36, lbs:180, fragile:true,  orient:'UP', stack:false, flat:false, glass:false, value:78000,  status:'queued' },
    { id:'i-13', ref:'CRT-9424', title:'Untitled (Sky), glass',artist:'E. Reyes',      year:1968, medium:'PNT', L:84, W:8,  H:60, lbs:185, fragile:true,  orient:'UP', stack:false, flat:false, glass:true,  value:520000, status:'queued' },
    { id:'i-14', ref:'CRT-9425', title:'Twelve Postcards',     artist:'J. Mer\u00e9',  year:2002, medium:'WRK', L:30, W:3,  H:24, lbs:14,  fragile:true,  orient:'UP', stack:true,  flat:true,  glass:false, value:8400,   status:'queued' },
  ];

  const mediumLabel = {
    PNT:'Painting', SCL:'Sculpture', WRK:'Work on paper', MIX:'Installation', DEC:'Decorative arts', PHT:'Photograph',
  };

  const scenario = {
    id: 's-01',
    name: 'Frieze Pickup \u2014 Brooklyn \u2192 London',
    facility: 'f-bk',
    destination: 'Park Royal Annex, London',
    pickupDate: '2026-05-21',
    arrivalWindow: '2026-05-24 \u2192 2026-05-26',
    handler: 'Ines Vidal',
    notes: 'Two crates require climate logger. Library of Glass to ride floor only.',
  };

  return { facilities, trucks, items, mediumLabel, scenario };
})();
