"""Attach venue coordinates to data/events.json (run after parse_sheet.py).

Coordinates hand-curated + web-verified Jul 2026. approx=True marks venues
located to street/area level rather than exact address. Events whose venue
isn't in the table get loc=None (UI shows no distance).
"""
import json, math, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent

# venue-string prefix/substring -> (lat, lon, approx, short label)
VENUES = [
    ('BONNE & Galerie de Schans',    (52.3745, 4.8973, False, 'Warmoesstraat 67')),
    ('Bar Prik / Spuistraat',        (52.3735, 4.8907, False, 'Spuistraat 109')),
    ('Prik; Bears Amsterdam',        (52.3735, 4.8907, False, 'Spuistraat 109')),
    ('W Amsterdam',                  (52.3726, 4.8917, False, 'Spuistraat 175')),
    ('Akhnaton',                     (52.3757, 4.8930, False, 'Nieuwezijds Kolk 25')),
    ('Dam Square',                   (52.3731, 4.8932, False, 'Dam')),
    ('Beursplein',                   (52.3747, 4.8955, False, 'Beursplein')),
    ('Zeedijk',                      (52.3742, 4.9002, False, 'Zeedijk')),
    ('Homomonument',                 (52.3745, 4.8843, False, 'Westermarkt')),
    ('Prinsengracht',                (52.3745, 4.8838, True,  'Prinsengracht (parade route)')),
    ('Stopera',                      (52.3676, 4.9013, False, 'Waterlooplein 22')),
    ('Waterkant',                    (52.3718, 4.8778, False, 'Marnixstraat 246')),
    ('Saarein',                      (52.3703, 4.8787, False, 'Elandsstraat 119')),
    ('Reguliersdwarsstraat',         (52.3663, 4.8917, False, 'Reguliersdwarsstraat')),
    ('Club NYX',                     (52.3662, 4.8926, False, 'Reguliersdwarsstraat 42')),
    ('RITA Community Center',        (52.3661, 4.8931, False, 'Reguliersdwarsstraat 54')),
    ('Blend XL',                     (52.3662, 4.8928, False, 'Reguliersdwarsstraat 44')),
    ('Rembrandtplein, Club Oliva',   (52.3663, 4.8966, False, 'Rembrandtplein')),
    ('Free Willie',                  (52.3652, 4.8997, False, 'Amstel 178')),
    ('Club Church',                  (52.3645, 4.8858, False, 'Kerkstraat 52')),
    ('Paradiso',                     (52.3622, 4.8839, False, 'Weteringschans 6')),
    ('Melkweg',                      (52.3647, 4.8812, False, 'Lijnbaansgracht 234A')),
    ('Chicago Social Club',          (52.3641, 4.8828, False, 'Leidseplein 12')),
    ('Hard Rock Cafe',               (52.3625, 4.8823, False, 'Max Euweplein 57')),
    ('Museumplein',                  (52.3579, 4.8816, False, 'Museumplein')),
    ('Concertgebouw',                (52.3564, 4.8790, False, 'Concertgebouwplein 10')),
    ('Vondelpark',                   (52.3580, 4.8686, False, 'Vondelpark')),
    ('TBA; ends at Vondelpark',      (52.3580, 4.8686, True,  'Vondelpark (route TBA)')),
    ('Martin Luther King Park',      (52.3444, 4.9002, True,  'MLK Park (march start)')),
    ('WestWeelde',                   (52.3859, 4.8772, False, 'Westergasterrein')),
    ('Westerunie',                   (52.3859, 4.8772, False, 'Westergasterrein')),
    ('Westerpark',                   (52.3872, 4.8735, False, 'Westerpark')),
    ('The Other Side',               (52.3931, 4.8786, False, 'Rigakade 10, Houthavens')),
    ('Lofi',                         (52.3921, 4.8383, False, 'Basisweg 63')),
    ('TILLATEC',                     (52.3667, 4.8500, False, 'Dr. Jan van Breemenstraat 1')),
    ('Tillatec',                     (52.3667, 4.8500, False, 'Dr. Jan van Breemenstraat 1')),
    ('RADION',                       (52.3527, 4.8283, False, 'Louwesweg 1')),
    ('Radion',                       (52.3527, 4.8283, False, 'Louwesweg 1')),
    ('Occii',                        (52.3505, 4.8555, False, 'Amstelveenseweg 134')),
    ("Sissi's",                      (52.3395, 4.8345, True,  'Anthony Fokkerweg 3')),
    ('Parallel',                     (52.3400, 4.9180, True,  'Overamstel')),
    ('The Social Hub',               (52.3505, 4.9089, False, 'Wibautstraat 129')),
    ('Generator Amsterdam',          (52.3624, 4.9152, False, 'Mauritskade 57')),
    ('Javaplein',                    (52.3646, 4.9421, False, 'Javaplein')),
    ('Panama',                       (52.3743, 4.9291, False, 'Oostelijke Handelskade 4')),
    ('Muziekgebouw',                 (52.3785, 4.9124, False, "Piet Heinkade 1")),
    ('Kaap Amsterdam',               (52.3728, 4.9605, True,  'Zuider IJdijk, Zeeburgereiland')),
    ('NDSM',                         (52.4013, 4.8935, False, 'NDSM-werf (ferry from CS)')),
    ('AFAS Live',                    (52.3125, 4.9444, False, 'ArenAPoort')),
    ('NAR, Utrecht',                 (52.1048, 5.0846, False, 'Nijverheidsweg 6, Utrecht')),
    ('Campsite in Zeewolde',         (52.3300, 5.5410, True,  'Zeewolde')),
    ('Ferropolis, Germany',          (51.7726, 12.4444, False, 'Ferropolis (DE)')),
]

HOTEL = {'name': 'Rho Hotel', 'addr': 'Nes 5–23', 'lat': 52.3722, 'lon': 4.8945}

def lookup(venue):
    for key, val in VENUES:
        if venue.lower().startswith(key.lower()) or key.lower() in venue.lower():
            return val
    return None

def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*r*math.asin(math.sqrt(a))

path = ROOT / 'data' / 'events.json'
events = json.loads(path.read_text())
missing = set()
for e in events:
    hit = lookup(e['venue'])
    if not hit:
        e['loc'] = None
        missing.add(e['venue'])
        continue
    lat, lon, approx, label = hit
    d = haversine_km(HOTEL['lat'], HOTEL['lon'], lat, lon) * 1.25  # route factor
    e['loc'] = {'lat': lat, 'lon': lon, 'approx': approx, 'label': label,
                'km': round(d, 2)}
path.write_text(json.dumps(events, ensure_ascii=False, indent=1))
print(f'geo: {sum(1 for e in events if e["loc"])}/{len(events)} events located')
if missing:
    print('no coords for:', ' | '.join(sorted(missing)))
