'use strict';
/* =========================================================
   ELEV8 — données fictives (aucune base de données)
   Tout est en mémoire et relatif à la date du jour.
   ========================================================= */
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let RNG = mulberry32(20261009);
const rnd = (a = 0, b = 1) => a + RNG() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const rpick = (arr) => arr[Math.floor(RNG() * arr.length)];
const chance = (p) => RNG() < p;
const T0 = today0();
const D = (days = 0, h = 9, m = 0) => { const d = addDays(T0, days); d.setHours(h, m, 0, 0); return d.toISOString(); };
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/* ---------- Référentiels ---------- */
const SPORTS = ['Musculation', 'Athlétisme', 'CrossFit', 'Natation'];
const PATTERNS = ['Squat', 'Hinge', 'Push', 'Pull', 'Carry', 'Core', 'Cardio', 'Mobilité', 'Compound', 'Isolation'];
const LIB_CATEGORIES = ['Squat', 'Hinge', 'Push', 'Pull', 'Carry', 'Core', 'Cardio', 'Mobilité'];
const LEVELS = ['Débutant', 'Intermédiaire', 'Avancé'];
const MUSCLES = ['Quadriceps', 'Fessiers', 'Ischio-jambiers', 'Pectoraux', 'Triceps', 'Dorsaux', 'Biceps', 'Deltoïdes', 'Core', 'Abdominaux', 'Trapèzes', 'Rhomboïdes'];
const EQUIPMENT = ['Barre', 'Haltères', 'Poulie', 'Barre de traction', 'Banc', 'Aucun', 'Foam Roller', 'Bâton', 'Barres parallèles'];
const SESSION_TYPES = ['Push', 'Pull', 'Upper', 'Lower', 'Full Body', 'Mobilité'];
const SESSION_GOALS = ['Puissance', 'Force', 'Explosivité', 'Hypertrophie', 'Endurance'];
const INTENSITIES = ['Faible', 'Modérée', 'Élevée'];
const PROGRAM_GOALS = ['Prise de masse', 'Sèche', 'Force', 'Explosivité', 'Hypertrophie', 'Endurance', 'Maintien', 'Mobilité', 'Cardio'];
const DEFAULT_LABELS = { reps: 'Reps', sets: 'Séries', load: 'Charge', rest: 'Repos' };
const RPE_SCALE = [
  [1, 'Ultra facile', 'Respiration calme'], [2, 'Très facile', 'Très légère activation'], [3, 'Facile', 'Je parle sans m’essouffler'],
  [4, 'Aisé', 'Je parle, léger essoufflement'], [5, 'Soutenu confortable', 'Conversation courte'], [6, 'Modérément dur', 'Conversation difficile'],
  [7, 'Dur', 'Respiration forte'], [8, 'Très dur', 'Respiration difficile à contrôler'], [9, 'Effort intense', 'Presque à la rupture'], [10, 'Effort maximal', 'Rien dans le réservoir'],
];
const FOOD_CATS = ['Glucides', 'Graisses', 'Laitiers', 'Légumes', 'Protéines', 'Personnalisé'];
const NUTRI_GOALS = ['Perte de poids', 'Prise de masse', 'Maintien', 'Recomposition corporelle'];
const DIET_TAGS = ['Végétarien', 'Végan', 'Sans gluten', 'Sans lactose'];
const ACTIVITY = [['sedentaire', 'Sédentaire', 1.2], ['leger', 'Légèrement actif', 1.375], ['modere', 'Modérément actif', 1.55], ['actif', 'Très actif', 1.725], ['extreme', 'Extrêmement actif', 1.9]];
const APPT_TYPES = ['Bilan mensuel', 'Suivi nutrition', 'Suivi technique', 'Découverte', 'Check-in hebdo', 'Urgence'];
const APPT_COLORS = { 'Bilan mensuel': 'var(--s1)', 'Suivi nutrition': 'var(--s3)', 'Suivi technique': 'var(--s7)', 'Découverte': 'var(--s4)', 'Check-in hebdo': 'var(--s5)', 'Urgence': 'var(--s8)' };
const PROSPECT_STATUS = [['todo', 'À contacter'], ['contacted', 'Contacté'], ['meeting', 'RDV planifié'], ['converted', 'Converti'], ['lost', 'Perdu']];
const PROSPECT_SOURCES = ['Ajout manuel', 'Recommandation', 'Instagram', 'Annuaire ELEV8', 'Lien de parrainage', 'Salle de sport'];
const CITIES = ['Lyon', 'Paris', 'Marseille', 'Bordeaux', 'Lille', 'Nantes', 'Toulouse', 'Nice', 'Montpellier', 'Strasbourg', 'Rennes', 'Grenoble', 'Annecy', 'Bruxelles', 'Genève', 'Villeurbanne'];
const SHIP_ZONES = ['France', 'Belgique', 'Suisse', 'Luxembourg', 'Allemagne', 'Espagne', 'Italie'];
const WATCH_BRANDS = [['apple', 'Apple Watch', '⌚'], ['garmin', 'Garmin', '🧭'], ['fitbit', 'Fitbit', '💠'], ['polar', 'Polar', '❄️'], ['samsung', 'Samsung Galaxy Watch', '🌀'], ['suunto', 'Suunto', '⛰️']];
const PLAN_NAMES = { trial: 'Essai', start: 'Start', pro: 'Pro', elite: 'Elite', free: 'Free', affiliated: 'Affiliated' };

/* =========================================================
   Bibliothèque d'exercices (≈ 220, contenus originaux ELEV8)
   nom | sport | pattern | niveau | muscles | équipement | unilatéral
   ========================================================= */
const EX_CODES = {
  s: { M: 'Musculation', A: 'Athlétisme', C: 'CrossFit', N: 'Natation' },
  p: { S: 'Squat', H: 'Hinge', Pu: 'Push', Pl: 'Pull', Ca: 'Carry', Co: 'Core', Cd: 'Cardio', Mo: 'Mobilité', Cp: 'Compound', Is: 'Isolation' },
  l: { D: 'Débutant', I: 'Intermédiaire', A: 'Avancé' },
  m: { Q: 'Quadriceps', F: 'Fessiers', IJ: 'Ischio-jambiers', P: 'Pectoraux', T: 'Triceps', Do: 'Dorsaux', B: 'Biceps', De: 'Deltoïdes', Co: 'Core', Ab: 'Abdominaux', Tr: 'Trapèzes', R: 'Rhomboïdes', Mo: 'Mollets' },
  e: { Ba: 'Barre', H: 'Haltères', Po: 'Poulie', BT: 'Barre de traction', Bc: 'Banc', 0: 'Aucun', FR: 'Foam Roller', Bt: 'Bâton', BP: 'Barres parallèles', K: 'Kettlebell', Ma: 'Machine', El: 'Élastique', Bx: 'Box', Cs: 'Corde à sauter', Cr: 'Corde', Ra: 'Rameur', MB: 'Med ball', An: 'Anneaux', Sl: 'Traîneau', Pb: 'Pull-buoy', Pq: 'Plaquettes', Pn: 'Planche de natation', AB: 'Assault bike', SE: 'Ski erg', Hd: 'Haies', Sb: 'Sandbag', Rw: 'Roue abdominale', Tb: 'Trap bar' },
};
const EX_RAW = `Back Squat|M|S|I|Q,F,IJ,Co|Ba
Front Squat|M|S|A|Q,F,Co|Ba
Goblet Squat|M|S|D|Q,F,Co|H
Squat au poids du corps|M|S|D|Q,F|0
Box Squat|M|S|I|Q,F,IJ|Ba,Bc
Pause Squat|M|S|A|Q,F,Co|Ba
Zercher Squat|M|S|A|Q,F,Co|Ba
Hack Squat|M|S|I|Q,F|Ma
Presse à cuisses|M|S|D|Q,F|Ma
Fente avant|M|S|D|Q,F|H|u
Fente arrière|M|S|D|Q,F|H|u
Fente marchée|M|S|I|Q,F,IJ|H|u
Fente latérale|M|S|I|Q,F|H|u
Split squat bulgare|M|S|I|Q,F|H,Bc|u
Step-up|M|S|D|Q,F|H,Bc|u
Pistol squat|M|S|A|Q,F,Co|0|u
Sissy squat|M|Is|A|Q|0
Leg extension|M|Is|D|Q|Ma
Chaise contre le mur|M|S|D|Q|0
Cossack squat|M|S|I|Q,F|0|u
Squat sauté|A|S|I|Q,F|0
Overhead squat|C|S|A|Q,F,De,Co|Ba
Soulevé de terre|M|H|I|IJ,F,Do,Tr,Co|Ba
Soulevé de terre roumain|M|H|I|IJ,F|Ba
Soulevé de terre jambes tendues|M|H|I|IJ,F|Ba
Soulevé de terre sumo|M|H|I|F,Q,IJ|Ba
Soulevé de terre trap bar|M|H|D|Q,F,IJ|Tb
RDL unilatéral haltère|M|H|I|IJ,F,Co|H|u
Good morning|M|H|A|IJ,F|Ba
Hip thrust|M|H|D|F,IJ|Ba,Bc
Pont fessier|M|H|D|F|0
Pont fessier unilatéral|M|H|D|F,IJ|0|u
Kettlebell swing|C|H|I|F,IJ,Co|K
Leg curl allongé|M|Is|D|IJ|Ma
Nordic curl|M|Is|A|IJ|0
Hyperextension|M|H|D|F,IJ,Co|Bc
Rack pull|M|H|I|Do,Tr,F|Ba
Soulevé de terre en déficit|M|H|A|IJ,F,Do|Ba
Pull-through poulie|M|H|D|F,IJ|Po
Kickback fessier poulie|M|Is|D|F|Po|u
Reverse hyper|M|H|I|F,IJ|Ma
Développé couché|M|Pu|I|P,T,De|Ba,Bc
Développé couché haltères|M|Pu|D|P,T,De|H,Bc
Développé incliné barre|M|Pu|I|P,De,T|Ba,Bc
Développé incliné haltères|M|Pu|D|P,De,T|H,Bc
Développé décliné|M|Pu|I|P,T|Ba,Bc
Développé couché prise serrée|M|Pu|I|T,P|Ba,Bc
Développé militaire|M|Pu|I|De,T,Co|Ba
Développé épaules haltères|M|Pu|D|De,T|H,Bc
Arnold press|M|Pu|I|De,T|H
Z press|M|Pu|A|De,T,Co|Ba
Landmine press|M|Pu|I|De,P|Ba|u
Squeeze press|M|Pu|I|P,T|H,Bc
Pompes|M|Pu|D|P,T,De,Co|0
Pompes inclinées|M|Pu|D|P,T|Bc
Pompes déclinées|M|Pu|I|P,De|Bc
Pompes diamant|M|Pu|I|T,P|0
Pompes pliométriques|A|Pu|A|P,T|0
Pike push-up|M|Pu|I|De,T|0
Handstand push-up|C|Pu|A|De,T|0
Dips|M|Pu|I|P,T,De|BP
Dips sur banc|M|Pu|D|T|Bc
Dips aux anneaux|C|Pu|A|P,T|An
Push press|C|Pu|I|De,T,Q|Ba
Écarté haltères|M|Is|D|P|H,Bc
Écarté poulie vis-à-vis|M|Is|I|P|Po
Écarté poulie basse|M|Is|I|P|Po
Pec deck|M|Is|D|P|Ma
Élévations latérales|M|Is|D|De|H
Élévations frontales|M|Is|D|De|H
Oiseau haltères|M|Is|D|De,R|H
Extension triceps poulie|M|Is|D|T|Po
Barre au front|M|Is|I|T|Ba,Bc
Extension triceps nuque|M|Is|D|T|H
Kickback triceps|M|Is|D|T|H|u
JM press|M|Is|A|T|Ba,Bc
Tractions pronation|M|Pl|I|Do,B,R|BT
Tractions supination|M|Pl|I|Do,B|BT
Tractions assistées élastique|M|Pl|D|Do,B|BT,El
Tractions lestées|M|Pl|A|Do,B,R|BT
Tractions kipping|C|Pl|I|Do,B|BT
Tirage vertical|M|Pl|D|Do,B|Po
Tirage vertical prise serrée|M|Pl|D|Do,B|Po
Rowing barre|M|Pl|I|Do,R,B,Tr|Ba
Rowing Pendlay|M|Pl|A|Do,R,Tr|Ba
Rowing haltère unilatéral|M|Pl|D|Do,R,B|H,Bc|u
Rowing poulie basse|M|Pl|D|Do,R,B|Po
Rowing inversé|M|Pl|D|Do,R,B|Ba
Rowing aux anneaux|C|Pl|D|Do,R,B|An
Rowing buste appuyé|M|Pl|D|Do,R|H,Bc
Seal row|M|Pl|I|Do,R|Ba,Bc
Meadows row|M|Pl|A|Do,R|Ba|u
Face pull|M|Pl|D|De,R,Tr|Po
Tirage menton|M|Pl|I|De,Tr|Ba
Pull-over poulie|M|Is|I|Do|Po
Pull-over haltère|M|Is|I|Do,P|H,Bc
Shrugs|M|Is|D|Tr|H
Curl biceps barre|M|Is|D|B|Ba
Curl haltères alterné|M|Is|D|B|H|u
Curl marteau|M|Is|D|B|H
Curl incliné|M|Is|I|B|H,Bc
Curl pupitre|M|Is|I|B|Ba,Bc
Curl poulie|M|Is|D|B|Po
Curl Zottman|M|Is|I|B|H
Muscle-up|C|Pl|A|Do,B,T,P|BT
Montée de corde|C|Pl|A|Do,B|Cr
Farmer walk|M|Ca|D|Tr,Co|H
Suitcase carry|M|Ca|I|Co,Tr|H|u
Overhead carry|M|Ca|I|De,Co|H
Front rack carry|C|Ca|I|Co,Q|K
Sandbag carry|C|Ca|I|Co,Do|Sb
Yoke walk|M|Ca|A|Co,Tr,Q|Ba
Poussée de traîneau|C|Ca|I|Q,F|Sl
Tirage de traîneau|C|Ca|I|IJ,Do|Sl
Planche (gainage)|M|Co|D|Co,Ab|0
Planche latérale|M|Co|D|Co|0|u
Gainage commando|M|Co|I|Co,T|0
Crunch|M|Co|D|Ab|0
Crunch poulie|M|Co|I|Ab|Po
Relevé de jambes suspendu|M|Co|I|Ab|BT
Toes-to-bar|C|Co|A|Ab,Do|BT
Roue abdominale|M|Co|I|Ab,Co|Rw
Dead bug|M|Co|D|Co,Ab|0
Bird dog|M|Co|D|Co|0
Hollow hold|C|Co|I|Ab,Co|0
Russian twist|M|Co|D|Ab,Co|H
Pallof press|M|Co|I|Co|Po
V-ups|M|Co|I|Ab|0
Sit-up|C|Co|D|Ab|0
GHD sit-up|C|Co|A|Ab|Ma
L-sit|C|Co|A|Ab,Co,T|BP
Woodchopper poulie|M|Co|I|Co,Ab|Po
Superman|M|Co|D|Co,F|0
Bear crawl|C|Co|D|Co,De,Q|0
Mountain climbers|C|Co|D|Co,Ab|0
Rameur|C|Cd|D|Do,Q,Co|Ra
Assault bike|C|Cd|D|Q,De|AB
Ski erg|C|Cd|D|Do,T,Co|SE
Corde à sauter|C|Cd|D|Mo,Q|Cs
Double unders|C|Cd|I|Mo,Q|Cs
Burpees|C|Cd|D|P,Q,Co|0
Burpee box jump-over|C|Cd|I|Q,F|Bx
Jumping jacks|C|Cd|D|Q,De|0
Battle ropes|C|Cd|D|De,Co|Cr
Vélo elliptique|M|Cd|D|Q,F|Ma
Stairmaster|M|Cd|D|Q,F|Ma
Wall ball|C|Cp|I|Q,De|MB
Thruster|C|Cp|I|Q,De,T|Ba
Épaulé-jeté|C|Cp|A|Q,F,De,Tr|Ba
Arraché|C|Cp|A|Q,F,De,Tr|Ba
Power clean|C|Cp|A|Q,F,IJ,Tr|Ba
Hang power clean|C|Cp|I|IJ,F,Tr|Ba
Power snatch|C|Cp|A|F,IJ,De,Tr|Ba
Devil press|C|Cp|A|P,De,F|H
Arraché haltère|C|Cp|I|De,F,IJ|H|u
Turkish get-up|C|Cp|A|De,Co,F|K|u
Wall walk|C|Pu|I|De,T,Co|0
Handstand hold|C|Pu|A|De,T,Co|0
Box jump|C|S|I|Q,F|Bx
Box step-over|C|S|D|Q,F|Bx
Footing|A|Cd|D|Q,IJ,Mo|0
Fractionné 30/30|A|Cd|I|Q,IJ,Mo|0
Sprint 60 m|A|Cd|A|Q,IJ,F|0
Sprint 100 m|A|Cd|A|Q,IJ,F|0
400 m|A|Cd|A|Q,IJ,F|0
Côtes|A|Cd|I|F,IJ,Q|0
Tempo run|A|Cd|I|Q,IJ|0
Fartlek|A|Cd|I|Q,IJ,Mo|0
Montées de genoux|A|Cd|D|Q,Co|0
Talons-fesses|A|Cd|D|IJ|0
Skipping A|A|Cd|I|Q,F|0
Skipping B|A|Cd|I|IJ,Q|0
Foulées bondissantes|A|Cp|I|Q,F,IJ|0
Bonds latéraux|A|Cp|I|F,Q|0|u
Sauts de haies|A|Cp|I|Q,F|Hd
Saut en longueur sans élan|A|Cp|I|Q,F,IJ|0
Drop jump|A|Cp|A|Q,F,Mo|Bx
Départ en starting-blocks|A|Cp|A|Q,F|0
Lancer de médecine-ball|A|Pu|I|P,De,Co|MB
Lancer de poids (technique)|A|Pu|A|De,P,Co|0
Crawl endurance|N|Cd|I|Do,De,Co|0
Crawl sprint 50 m|N|Cd|A|Do,De|0
Brasse|N|Cd|D|P,Q|0
Dos crawlé|N|Cd|I|Do,De|0
Papillon|N|Cd|A|Do,De,P,Co|0
Battements planche|N|Cd|D|Q,F|Pn
Crawl pull-buoy|N|Pl|I|Do,De|Pb
Crawl plaquettes|N|Pl|I|Do,De,P|Pq
Éducatif rattrapé|N|Cd|D|De,Do|0
Éducatif 6-1-6|N|Cd|I|Co,De|0
Virage culbute|N|Cp|I|Co,Ab|0
Ondulations sous-marines|N|Co|A|Co,Ab,F|0
4 nages|N|Cd|A|Do,De,P,Q|0
Aquajogging|N|Cd|D|Q,IJ|0
Foam roller thoracique|M|Mo|D|Do,R|FR
Foam roller quadriceps|M|Mo|D|Q|FR
Foam roller ischio-jambiers|M|Mo|D|IJ|FR
Rotation thoracique au bâton|M|Mo|D|Do,Co|Bt
Dislocations d’épaules au bâton|M|Mo|D|De,Tr|Bt
World’s greatest stretch|M|Mo|D|F,IJ,Co|0|u
Mobilité hanches 90/90|M|Mo|D|F|0
Étirement fléchisseurs de hanche|M|Mo|D|Q,F|0|u
Chat-vache|M|Mo|D|Co,Do|0
Posture de l’enfant|M|Mo|D|Do|0
Squat profond tenu|M|Mo|D|Q,F|0
Cercles de bras|M|Mo|D|De|0
Fente Spiderman|M|Mo|D|F,IJ|0|u
Wall slides|M|Mo|D|De,R,Tr|0
Mobilité cheville au mur|M|Mo|D|Mo|0|u
Posture du pigeon|M|Mo|D|F|0|u
Étirement ischio au bâton|M|Mo|D|IJ|Bt
Jefferson curl|M|Mo|A|IJ,Do|H
Scapular pull-up|M|Mo|D|Do,R,Tr|BT
Band pull-apart|M|Mo|D|R,De|El
Extensions mollets debout|M|Is|D|Mo|Ma
Mollets assis|M|Is|D|Mo|Ma
Abduction hanche machine|M|Is|D|F|Ma`;
const PATTERN_TIPS = {
  Squat: { d: 'Flexion de hanches et de genoux pour renforcer le bas du corps.', c: ['Poitrine haute', 'Genoux dans l’axe des pieds', 'Pieds ancrés au sol'], e: ['Dos arrondi', 'Genoux vers l’intérieur', 'Talons qui décollent'] },
  Hinge: { d: 'Charnière de hanche : on recule les fesses en gardant le dos neutre.', c: ['Dos neutre', 'Hanches vers l’arrière', 'Charge proche du corps'], e: ['Dos arrondi', 'Genoux trop fléchis', 'Hyperextension en fin de mouvement'] },
  Push: { d: 'Mouvement de poussée du haut du corps.', c: ['Omoplates serrées', 'Gainage abdominal', 'Descente contrôlée'], e: ['Coudes trop ouverts', 'Bas du dos cambré', 'Amplitude incomplète'] },
  Pull: { d: 'Mouvement de tirage du haut du corps.', c: ['Initier avec les omoplates', 'Coudes près du corps', 'Poitrine sortie'], e: ['Élan du corps', 'Épaules qui montent', 'Amplitude incomplète'] },
  Carry: { d: 'Porter une charge en marchant pour renforcer le gainage et la prise.', c: ['Buste droit', 'Pas courts et contrôlés', 'Épaules basses'], e: ['Buste qui penche', 'Respiration bloquée', 'Pas précipités'] },
  Core: { d: 'Renforcement de la sangle abdominale et stabilité du tronc.', c: ['Bassin neutre', 'Respiration contrôlée', 'Nombril rentré'], e: ['Bas du dos creusé', 'Apnée prolongée', 'Nuque en tension'] },
  Cardio: { d: 'Travail cardio-vasculaire, à régler en durée, distance ou allure.', c: ['Rythme régulier', 'Respiration ample', 'Posture relâchée'], e: ['Départ trop rapide', 'Foulée trop longue', 'Épaules crispées'] },
  Mobilité: { d: 'Exercice de mobilité pour gagner en amplitude articulaire.', c: ['Mouvement lent', 'Respirer dans la position', 'Rester sans douleur'], e: ['Forcer l’amplitude', 'Compenser avec le dos', 'Aller trop vite'] },
  Compound: { d: 'Mouvement polyarticulaire qui mobilise plusieurs groupes musculaires.', c: ['Gainage constant', 'Trajectoire fluide', 'Extension complète'], e: ['Bras qui tirent trop tôt', 'Réception instable', 'Dos arrondi'] },
  Isolation: { d: 'Exercice ciblé sur un seul muscle.', c: ['Contrôle total', 'Contraction en fin de mouvement', 'Pas d’élan'], e: ['Charge trop lourde', 'Élan du corps', 'Amplitude partielle'] },
};
const EX_SPECIFIC = {
  'Back Squat': { d: 'Squat barre placée sur le haut du dos : l’exercice roi du bas du corps.', c: ['Poitrine haute', 'Genoux vers l’extérieur', 'Descendre sous la parallèle si la mobilité le permet'], e: ['Dos arrondi', 'Genoux vers l’intérieur', 'Talons qui décollent'] },
  'Développé couché': { d: 'Poussée horizontale allongé sur un banc, barre descendue au niveau des pectoraux.', c: ['Omoplates serrées', 'Pieds ancrés au sol', 'Barre au bas des pectoraux'], e: ['Fesses qui décollent', 'Coudes à 90°', 'Rebond sur la poitrine'] },
  'Soulevé de terre': { d: 'Soulever la barre du sol jusqu’à l’extension complète des hanches.', c: ['Barre au contact des tibias', 'Dos gainé', 'Pousser le sol avec les jambes'], e: ['Dos arrondi', 'Barre qui s’éloigne', 'Hyperextension en haut'] },
  Pompes: { d: 'Poussée au poids du corps, mains au sol.', c: ['Corps gainé de la tête aux pieds', 'Mains sous les épaules', 'Poitrine proche du sol'], e: ['Bassin qui s’affaisse', 'Coudes trop écartés', 'Amplitude partielle'] },
  'Tractions pronation': { d: 'Tirage vertical au poids du corps, prise en pronation.', c: ['Partir bras tendus', 'Menton au-dessus de la barre', 'Omoplates basses'], e: ['Élan des jambes', 'Demi-amplitude', 'Épaules qui montent'] },
  'Hip thrust': { d: 'Extension de hanche dos appuyé sur un banc, charge sur le bassin.', c: ['Menton rentré', 'Tibias verticaux en haut', 'Serrer les fessiers 1 s'], e: ['Cambrer le bas du dos', 'Pieds trop loin', 'Pousser avec les orteils'] },
  'Planche (gainage)': { d: 'Gainage statique sur les avant-bras.', c: ['Corps aligné', 'Fessiers contractés', 'Respirer calmement'], e: ['Bassin trop haut', 'Dos creusé', 'Tête qui tombe'] },
  'Kettlebell swing': { d: 'Balancé explosif de kettlebell piloté par les hanches.', c: ['Charnière de hanche', 'Bras relâchés', 'Fessiers serrés en haut'], e: ['Squatter au lieu de basculer', 'Tirer avec les bras', 'Dos arrondi'] },
  'Fractionné 30/30': { d: '30 secondes rapides, 30 secondes de récupération active.', c: ['Allure contrôlée sur la fraction rapide', 'Récupération en trottinant', 'Garder une foulée courte'], e: ['Partir trop vite', 'S’arrêter pendant la récupération', 'Négliger l’échauffement'] },
};

const DB = {};
DB.exercises = EX_RAW.trim().split('\n').map((line, i) => {
  const [name, s, p, l, m, e, u] = line.trim().split('|');
  const pattern = EX_CODES.p[p];
  const tips = EX_SPECIFIC[name] || PATTERN_TIPS[pattern];
  return {
    id: `ex${i + 1}`, name, sport: EX_CODES.s[s], pattern, level: EX_CODES.l[l],
    muscles: m.split(',').map((k) => EX_CODES.m[k] || k), equipment: e.split(',').map((k) => EX_CODES.e[k] || k),
    unilateral: u === 'u', desc: tips.d, cues: [...tips.c], errors: [...tips.e],
    source: 'elev8', ownerId: 'elev8', hidden: false, removed: false,
    media: { video: true, image: '', videoFile: '', youtube: '' }, createdAt: D(-260 + (i % 40)),
  };
});
const EXN = {}; DB.exercises.forEach((x) => { EXN[x.name] = x.id; });
const X = (name) => { if (!EXN[name]) console.warn('Exercice inconnu', name); return EXN[name]; };
function addCustomExercise(o) {
  const ex = { id: uid('ex'), sport: 'Musculation', pattern: 'Isolation', level: 'Intermédiaire', muscles: [], equipment: ['Aucun'], unilateral: false, desc: '', cues: [], errors: [], source: 'coach', ownerId: null, hidden: false, removed: false, media: { video: false, image: '', videoFile: '', youtube: '' }, createdAt: D(-20), ...o };
  DB.exercises.push(ex); EXN[ex.name] = ex.id; return ex;
}
addCustomExercise({ name: 'Squat landmine tempo', sport: 'Musculation', pattern: 'Squat', level: 'Intermédiaire', muscles: ['Quadriceps', 'Fessiers', 'Core'], equipment: ['Barre'], desc: 'Variante guidée du squat, idéale pour travailler le tempo sans charger la colonne.', cues: ['Barre contre la poitrine', 'Descente en 4 s', 'Genoux vers l’extérieur'], errors: ['Talons qui décollent', 'Remonter trop vite'], source: 'coach', ownerId: 'c1', media: { video: false, image: '', videoFile: '', youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, createdAt: D(-34) });
addCustomExercise({ name: 'Gainage Pallof à genoux', sport: 'Musculation', pattern: 'Core', level: 'Débutant', muscles: ['Core', 'Abdominaux'], equipment: ['Poulie'], desc: 'Anti-rotation à genoux pour apprendre à verrouiller le tronc.', cues: ['Bassin neutre', 'Bras tendus devant la poitrine'], errors: ['Rotation du buste'], source: 'coach', ownerId: 'c1', createdAt: D(-12) });
addCustomExercise({ name: 'Circuit corde ondulatoire 20/10', sport: 'CrossFit', pattern: 'Cardio', level: 'Intermédiaire', muscles: ['Deltoïdes', 'Core'], equipment: ['Corde'], desc: '20 s d’ondulations / 10 s de repos.', cues: ['Genoux fléchis', 'Ondulations amples'], errors: ['Dos rond'], source: 'coach', ownerId: 'c5', createdAt: D(-50) });
addCustomExercise({ name: 'Squat extrême sur ballon', sport: 'Musculation', pattern: 'Squat', level: 'Avancé', muscles: ['Quadriceps'], equipment: ['Aucun'], desc: 'Vidéo signalée : contenu dangereux.', cues: [], errors: [], source: 'coach', ownerId: 'c9', media: { video: true, image: '', videoFile: '', youtube: '' }, createdAt: D(-8) });
addCustomExercise({ name: 'Routine épaules du matin', sport: 'Musculation', pattern: 'Mobilité', level: 'Débutant', muscles: ['Deltoïdes', 'Trapèzes'], equipment: ['Élastique'], desc: 'Ma petite routine perso avant le travail.', cues: ['Mouvements lents'], errors: [], source: 'athlete', ownerId: 'a1', createdAt: D(-15) });

/* =========================================================
   Coachs
   ========================================================= */
const COACH_ROWS = [
  ['c1', 'Thomas', 'Mercier', 'Mercier Performance', 'Fit Arena', 'Lyon', 'pro', 'monthly', 'active', 'approved', false, 'none', 'verified', 'Musculation|Recomposition|Force', 412, 4.9],
  ['c2', 'Sophie', 'Garnier', 'SG Coaching', 'Neoness République', 'Paris', 'elite', 'annual', 'active', 'approved', true, 'approved', 'verified', 'Perte de poids|Nutrition', 380, 4.8],
  ['c3', 'Malik', 'Benali', 'Malik Athletics', 'Stade Delort', 'Marseille', 'pro', 'monthly', 'active', 'pending', false, 'pending', 'incomplete', 'Athlétisme|Explosivité', 60, 4.7],
  ['c4', 'Nadia', 'Haddad', 'Nadia Fit', 'L’Usine', 'Bordeaux', 'elite', 'monthly', 'active', 'approved', true, 'approved', 'verified', 'Hypertrophie|Remise en forme', 510, 4.9],
  ['c5', 'Kevin', 'Roussel', 'KR Training', 'CrossFit Lille Nord', 'Lille', 'start', 'monthly', 'active', 'approved', true, 'approved', 'verified', 'CrossFit|Cardio', 220, 4.6],
  ['c6', 'Julie', 'Fontaine', 'Julie Move', 'Studio Move', 'Nantes', 'start', 'monthly', 'active', 'approved', true, 'approved', 'verified', 'Mobilité|Pilates', 150, 4.8],
  ['c7', 'Antoine', 'Girard', 'Girard Strength', 'Iron Club', 'Toulouse', 'pro', 'annual', 'active', 'approved', true, 'approved', 'verified', 'Force|Powerlifting', 300, 4.9],
  ['c8', 'Camille', 'Rousseau', 'CR Natation', 'Piscine Antigone', 'Montpellier', 'pro', 'monthly', 'active', 'approved', true, 'approved', 'verified', 'Natation|Triathlon', 260, 4.7],
  ['c9', 'Yanis', 'Belkacem', 'YB Performance', 'Basic Gym Nice', 'Nice', 'start', 'monthly', 'inactive', 'approved', false, 'pending', 'verified', 'Musculation', 190, 4.4],
  ['c10', 'Laura', 'Chevalier', 'Laura Coaching', 'À domicile', 'Strasbourg', 'trial', 'monthly', 'active', 'none', false, 'none', 'incomplete', 'Remise en forme', 9, 0],
  ['c11', 'Mehdi', 'Amrani', 'MA Fight Fit', 'Boxing Club 11', 'Paris', 'pro', 'monthly', 'ended', 'approved', true, 'approved', 'verified', 'Boxe|Cardio', 420, 4.5],
  ['c12', 'Clara', 'Vincent', 'Clara Run', 'Bois de la Cambre', 'Bruxelles', 'start', 'monthly', 'active', 'approved', true, 'approved', 'verified', 'Course à pied|Endurance', 120, 4.8],
  ['c13', 'Romain', 'Lambert', 'Lambert Coaching', 'Fitness Park', 'Rennes', 'trial', 'monthly', 'active', 'pending', false, 'pending', 'incomplete', 'Musculation|Prise de masse', 4, 0],
  ['c14', 'Inès', 'Moreau', 'IM Wellness', 'Studio Lumière', 'Lyon', 'elite', 'annual', 'active', 'approved', true, 'approved', 'verified', 'Nutrition|Recomposition', 350, 4.9],
  ['c15', 'Samir', 'Rahmani', 'Samir Pro Coach', 'Keep Cool', 'Grenoble', 'start', 'monthly', 'ended', 'approved', false, 'none', 'verified', 'Musculation', 280, 4.2],
  ['c16', 'Zoé', 'Faure', 'Zoé Yoga Fit', 'Studio Lac', 'Annecy', 'pro', 'monthly', 'active', 'approved', true, 'approved', 'verified', 'Mobilité|Yoga', 95, 4.8],
];
function mkCoach(o) {
  const spec = o.specialties || ['Remise en forme'];
  return {
    phone: `06 ${rint(10, 99)} ${rint(10, 99)} ${rint(10, 99)} ${rint(10, 99)}`, gym: '', city: 'Paris', specialties: spec,
    bio: `Coach ${spec[0].toLowerCase()} basé·e à ${o.city || 'Paris'}. J’accompagne mes athlètes avec des programmes sur mesure, un suivi nutritionnel et des bilans réguliers.`,
    plan: 'trial', billing: 'monthly', subStatus: 'active', since: D(-1), endDate: D(30), kyc: 'none', certified: false, certStatus: 'none', stripe: 'incomplete',
    rating: 0, reviews: 0, suspended: false, freeAccess: false, lastLogin: D(0, 8, 30), photo: '',
    settings: { libraryVisible: true, customVisible: true, notifs: { checkin: true, reminder: true, appt24: true } },
    branding: { enabled: false, logoText: o.brand || `${o.first} Coaching`, primary: '#0F1115', accent: '#C5F23A', logo: '', signature: `${o.first} — ${o.brand || 'Coach'}`, emailIntro: 'Bonjour {{prenom}},', publicPage: { enabled: true, theme: 'dark', tagline: 'Deviens la meilleure version de toi-même', cta: 'Réserver un appel découverte', cover: '' } },
    refCode: `${slug(o.first).toUpperCase()}-${String(hashStr(o.id || o.first) % 900 + 100)}`,
    ...o,
  };
}
DB.coaches = COACH_ROWS.map(([id, first, last, brand, gym, city, plan, billing, subStatus, kyc, certified, certStatus, stripe, spec, since, rating], i) => mkCoach({
  id, first, last, brand, gym, city, plan, billing, subStatus, kyc, certified, certStatus, stripe, specialties: spec.split('|'), since: D(-since), rating, reviews: rating ? rint(8, 64) : 0,
  email: `${slug(first)}@${slug(brand)}.fr`, color: AV_COLORS[i % AV_COLORS.length],
  endDate: subStatus === 'ended' ? D(-rint(12, 70)) : D(rint(4, 28)), lastLogin: D(-rint(0, subStatus === 'active' ? 4 : 40), rint(7, 21), rint(0, 59)),
}));
Object.assign(DB.coaches[0], {
  email: 'thomas@mercier-perf.fr', phone: '06 12 34 56 78', refCode: 'THOMAS-M8', rating: 4.9, reviews: 38, color: '#2a78d6',
  bio: 'Coach diplômé d’État (BPJEPS AF). 9 ans d’expérience en musculation et recomposition corporelle. J’accompagne mes athlètes en présentiel à Lyon et à distance, avec un suivi sport + nutrition hebdomadaire.',
});
DB.coaches.find((c) => c.id === 'c2').branding = { ...DB.coaches.find((c) => c.id === 'c2').branding, enabled: true, accent: '#F59E0B', logoText: 'SG Coaching' };

/* =========================================================
   Athlètes
   ========================================================= */
const FN_F = ['Léna', 'Alice', 'Louise', 'Rose', 'Ambre', 'Juliette', 'Mila', 'Agathe', 'Eva', 'Margaux', 'Lou', 'Romane', 'Nina', 'Elsa', 'Salomé', 'Héloïse', 'Inaya', 'Lya', 'Maya', 'Sofia', 'Léonie', 'Capucine', 'Aya', 'Noémie'];
const FN_M = ['Gabriel', 'Raphaël', 'Arthur', 'Jules', 'Maël', 'Noah', 'Sacha', 'Gabin', 'Liam', 'Tom', 'Paul', 'Nolan', 'Ethan', 'Malo', 'Timéo', 'Axel', 'Mathis', 'Ilyes', 'Younes', 'Aaron', 'Eliott', 'Marius', 'Kylian', 'Rayane'];
const LN = ['Bertrand', 'Morel', 'Giraud', 'Mathieu', 'Clément', 'Gauthier', 'Perrin', 'Robin', 'Masson', 'Sanchez', 'Henry', 'Nicolas', 'Marchand', 'Duval', 'Denis', 'Dumont', 'Lemaire', 'Noël', 'Meyer', 'Dufour', 'Meunier', 'Brun', 'Blanchard', 'Barbier', 'Arnaud', 'Martinez', 'Gérard', 'Roche', 'Renard', 'Schmitt', 'Colin', 'Vidal', 'Caron', 'Picard', 'Fabre', 'Aubert', 'Lemoine', 'Renaud', 'Dumas', 'Lacroix', 'Olivier', 'Bourgeois'];
const GOALS = ['Perte de poids', 'Prise de masse', 'Recomposition corporelle', 'Force', 'Hypertrophie', 'Remise en forme', 'Endurance', 'Maintien', 'Explosivité'];
function mkAthlete(o) {
  const g = o.gender || (chance(0.5) ? 'F' : 'M');
  const age = o.age || rint(19, 48);
  return {
    email: `${slug(o.first)}.${slug(o.last)}@email.fr`, phone: `06 ${rint(10, 99)} ${rint(10, 99)} ${rint(10, 99)} ${rint(10, 99)}`, gender: g,
    birth: ymd(new Date(T0.getFullYear() - age, rint(0, 11), rint(1, 28))),
    height: g === 'F' ? rint(156, 176) : rint(168, 191), weight: round(g === 'F' ? rnd(53, 76) : rnd(67, 96), 1),
    activity: rpick(['leger', 'modere', 'modere', 'actif']), goal: rpick(GOALS), prefs: [], allergies: '', coachId: null, status: 'active',
    since: D(-rint(20, 320)), lastLogin: D(-rint(0, 9), rint(7, 22), rint(0, 59)), city: rpick(CITIES), notes: '', tags: [],
    color: AV_COLORS[hashStr(o.first + o.last) % AV_COLORS.length], watch: { connected: false, brand: null, share: false, since: null, types: [] },
    kycVerified: false, address: null, suspended: false, strength: round(rnd(0.72, 1.12), 2), adh: round(rnd(0.6, 0.95), 2), photo: '',
    ...o,
  };
}
DB.athletes = [];
const ATH_C1 = [
  ['a1', 'Léa', 'Martin', 'F', 29, 'Recomposition corporelle', 'active'], ['a3', 'Karim', 'Haddad', 'M', 34, 'Prise de masse', 'active'],
  ['a4', 'Inès', 'Dubois', 'F', 26, 'Perte de poids', 'active'], ['a5', 'Mehdi', 'Benyahia', 'M', 31, 'Force', 'active'],
  ['a6', 'Camille', 'Petit', 'F', 38, 'Remise en forme', 'active'], ['a7', 'Lucas', 'Moreau', 'M', 24, 'Hypertrophie', 'active'],
  ['a8', 'Sarah', 'Lefèvre', 'F', 33, 'Perte de poids', 'active'], ['a9', 'Nathan', 'Girard', 'M', 27, 'Explosivité', 'active'],
  ['a10', 'Chloé', 'Bernard', 'F', 30, 'Maintien', 'active'], ['a11', 'Yasmine', 'Rahmani', 'F', 28, 'Recomposition corporelle', 'active'],
  ['a12', 'Julien', 'Roux', 'M', 41, 'Perte de poids', 'active'], ['a13', 'Emma', 'Laurent', 'F', 22, 'Hypertrophie', 'active'],
  ['a14', 'Adam', 'Simon', 'M', 35, 'Force', 'active'], ['a15', 'Manon', 'Fournier', 'F', 27, 'Endurance', 'active'],
  ['a16', 'Théo', 'Bonnet', 'M', 29, 'Prise de masse', 'active'], ['a17', 'Jade', 'Michel', 'F', 25, 'Remise en forme', 'paused'],
  ['a18', 'Rayan', 'Garcia', 'M', 23, 'Explosivité', 'active'], ['a19', 'Clara', 'Durand', 'F', 36, 'Perte de poids', 'active'],
  ['a20', 'Bilal', 'Amrani', 'M', 30, 'Hypertrophie', 'active'], ['a21', 'Lina', 'Costa', 'F', 31, 'Maintien', 'active'],
  ['a22', 'Maxime', 'Leroy', 'M', 28, 'Force', 'active'], ['a23', 'Zoé', 'Nguyen', 'F', 24, 'Recomposition corporelle', 'active'],
];
ATH_C1.forEach(([id, first, last, gender, age, goal, status]) => DB.athletes.push(mkAthlete({ id, first, last, gender, age, goal, status, coachId: 'c1', city: chance(0.7) ? 'Lyon' : 'Villeurbanne' })));
Object.assign(DB.athletes.find((a) => a.id === 'a1'), {
  email: 'lea.martin@email.fr', phone: '06 45 22 18 90', birth: '1997-04-12', height: 168, weight: 63.4, activity: 'modere', prefs: ['Sans lactose'], allergies: '',
  since: D(-96), lastLogin: D(0, 7, 42), city: 'Lyon', strength: 0.8, adh: 0.93, tags: ['Présentiel', 'Premium'],
  notes: 'Ancienne gymnaste. Légère gêne à l’épaule gauche sur les développés au-dessus de la tête — privilégier les haltères.',
  watch: { connected: true, brand: 'garmin', share: true, since: D(-60), types: ['hr', 'kcal', 'distance', 'steps', 'sleep', 'rhr'] },
  address: { name: 'Léa Martin', line1: '14 rue de la République', zip: '69002', city: 'Lyon', country: 'France' },
});
Object.assign(DB.athletes.find((a) => a.id === 'a3'), { email: 'karim.haddad@email.fr', weight: 78.2, height: 181, strength: 1.12, adh: 0.84, since: D(-60), notes: 'Travail en horaires décalés : séances le soir.', tags: ['À distance'] });
Object.assign(DB.athletes.find((a) => a.id === 'a4'), { kycVerified: false, adh: 0.78 });
Object.assign(DB.athletes.find((a) => a.id === 'a17'), { adh: 0.4, notes: 'Pause de 3 semaines (déplacement professionnel).' });
DB.athletes.push(mkAthlete({ id: 'a24', first: 'Franck', last: 'Benchetrit', gender: 'M', age: 45, goal: 'Perte de poids', status: 'pre', coachId: 'c1', email: 'franck.benchetrit@email.fr', phone: '06 71 30 44 12', since: D(-1, 18, 4), lastLogin: null, notes: 'Ancienne entorse de la cheville droite. Objectif : −8 kg avant l’été. Préfère les séances tôt le matin.' }));
DB.athletes.push(mkAthlete({ id: 'a25', first: 'Anaïs', last: 'Muller', gender: 'F', age: 32, goal: 'Remise en forme', status: 'pre', coachId: 'c1', email: 'anais.muller@email.fr', since: D(-4, 11, 20), lastLogin: null, notes: 'Post-partum (8 mois). Reprise progressive validée par son médecin.' }));
DB.athletes.push(mkAthlete({ id: 'a2', first: 'Hugo', last: 'Lefèvre', gender: 'M', age: 26, goal: 'Prise de masse', email: 'hugo.lefevre@email.fr', height: 178, weight: 71.5, activity: 'modere', coachId: null, since: D(-18), lastLogin: D(0, 8, 5), city: 'Lyon', strength: 0.9, adh: 0.86, watch: { connected: false, brand: null, share: false, since: null, types: [] }, address: { name: 'Hugo Lefèvre', line1: '3 place Bellecour', zip: '69002', city: 'Lyon', country: 'France' } }));
const OTHER_COUNTS = { c2: 9, c3: 3, c4: 12, c5: 5, c6: 3, c7: 8, c8: 6, c9: 2, c10: 1, c12: 4, c13: 1, c14: 10, c16: 6 };
let athN = 30;
Object.entries(OTHER_COUNTS).forEach(([cid, n]) => {
  for (let i = 0; i < n; i++) {
    const g = chance(0.5) ? 'F' : 'M';
    DB.athletes.push(mkAthlete({ id: `a${athN++}`, first: rpick(g === 'F' ? FN_F : FN_M), last: rpick(LN), gender: g, coachId: cid, status: chance(0.9) ? 'active' : 'inactive', city: DB.coaches.find((c) => c.id === cid).city }));
  }
});
for (let i = 0; i < 11; i++) {
  const g = chance(0.5) ? 'F' : 'M';
  DB.athletes.push(mkAthlete({ id: `a${athN++}`, first: rpick(g === 'F' ? FN_F : FN_M), last: rpick(LN), gender: g, coachId: null, since: D(-rint(3, 120)) }));
}

/* =========================================================
   Nutrition : ingrédients, menus, recettes
   ========================================================= */
const ING_ROWS = [
  ['Blanc de poulet', 'Protéines', '🍗', 120, 22.5, 0, 2.6, '1 filet', 150],
  ['Œuf entier', 'Protéines', '🥚', 143, 12.6, 0.7, 9.5, '1 œuf', 55],
  ['Blanc d’œuf', 'Protéines', '🥚', 52, 10.9, 0.7, 0.2, '1 blanc', 33],
  ['Saumon', 'Protéines', '🐟', 208, 20, 0, 13, '1 pavé', 125],
  ['Thon au naturel', 'Protéines', '🐟', 116, 26, 0, 1, '1 boîte', 140],
  ['Bœuf haché 5 %', 'Protéines', '🥩', 137, 21, 0, 5, '1 steak', 100],
  ['Escalope de dinde', 'Protéines', '🍖', 111, 24, 0, 1.5, '1 escalope', 120],
  ['Crevettes', 'Protéines', '🍤', 99, 24, 0.2, 0.3, '1 portion', 120],
  ['Lentilles cuites', 'Protéines', '🫘', 116, 9, 20, 0.4, '1 bol', 200],
  ['Tofu ferme', 'Protéines', '🧈', 144, 15.7, 2.3, 8.7, '1 bloc', 100],
  ['Protéine en poudre', 'Protéines', '🥤', 380, 78, 8, 5, '1 dose', 30],
  ['Riz basmati cuit', 'Glucides', '🍚', 130, 2.7, 28, 0.3, '1 bol', 150],
  ['Flocons d’avoine', 'Glucides', '🥣', 372, 13.5, 58.7, 7, '1 portion', 40],
  ['Pâtes complètes cuites', 'Glucides', '🍝', 124, 5, 25, 1.1, '1 assiette', 180],
  ['Patate douce cuite', 'Glucides', '🍠', 90, 2, 20.7, 0.2, '1 patate', 150],
  ['Pomme de terre cuite', 'Glucides', '🥔', 86, 1.7, 20, 0.1, '2 pommes de terre', 200],
  ['Pain complet', 'Glucides', '🍞', 247, 13, 41, 3.4, '1 tranche', 35],
  ['Quinoa cuit', 'Glucides', '🌾', 120, 4.4, 21.3, 1.9, '1 bol', 150],
  ['Banane', 'Glucides', '🍌', 89, 1.1, 22.8, 0.3, '1 banane', 120],
  ['Pomme', 'Glucides', '🍎', 52, 0.3, 13.8, 0.2, '1 pomme', 150],
  ['Myrtilles', 'Glucides', '🫐', 57, 0.7, 14.5, 0.3, '1 poignée', 80],
  ['Fraises', 'Glucides', '🍓', 32, 0.7, 7.7, 0.3, '1 barquette', 125],
  ['Galette de riz', 'Glucides', '🍘', 387, 8, 81, 2.8, '1 galette', 9],
  ['Miel', 'Glucides', '🍯', 304, 0.3, 82, 0, '1 c. à soupe', 21],
  ['Huile d’olive', 'Graisses', '🫒', 884, 0, 0, 100, '1 c. à soupe', 10],
  ['Avocat', 'Graisses', '🥑', 160, 2, 8.5, 14.7, '½ avocat', 70],
  ['Amandes', 'Graisses', '🌰', 579, 21, 21.6, 49.9, '1 poignée', 25],
  ['Beurre de cacahuète', 'Graisses', '🥜', 588, 25, 20, 50, '1 c. à soupe', 16],
  ['Cerneaux de noix', 'Graisses', '🌰', 654, 15, 14, 65, '1 poignée', 20],
  ['Chocolat noir 85 %', 'Graisses', '🍫', 600, 10, 20, 50, '2 carrés', 20],
  ['Graines de chia', 'Graisses', '🌱', 486, 17, 42, 31, '1 c. à soupe', 12],
  ['Fromage blanc 0 %', 'Laitiers', '🥛', 46, 7.5, 4, 0.1, '1 pot', 100],
  ['Skyr nature', 'Laitiers', '🥛', 63, 11, 4, 0.2, '1 pot', 150],
  ['Lait demi-écrémé', 'Laitiers', '🥛', 46, 3.2, 4.8, 1.6, '1 verre', 250],
  ['Yaourt grec', 'Laitiers', '🥣', 97, 9, 3.6, 5, '1 pot', 150],
  ['Emmental', 'Laitiers', '🧀', 380, 28, 0, 29, '1 portion', 30],
  ['Mozzarella', 'Laitiers', '🧀', 254, 18, 2, 19.5, '½ boule', 60],
  ['Brocoli', 'Légumes', '🥦', 34, 2.8, 7, 0.4, '1 portion', 150],
  ['Épinards', 'Légumes', '🥬', 23, 2.9, 3.6, 0.4, '1 portion', 100],
  ['Carotte', 'Légumes', '🥕', 41, 0.9, 9.6, 0.2, '1 carotte', 80],
  ['Tomate', 'Légumes', '🍅', 18, 0.9, 3.9, 0.2, '1 tomate', 120],
  ['Courgette', 'Légumes', '🥒', 17, 1.2, 3.1, 0.3, '½ courgette', 150],
  ['Haricots verts', 'Légumes', '🫛', 31, 1.8, 7, 0.2, '1 portion', 150],
  ['Poivron rouge', 'Légumes', '🫑', 31, 1, 6, 0.3, '½ poivron', 80],
  ['Champignons de Paris', 'Légumes', '🍄', 22, 3.1, 3.3, 0.3, '1 portion', 100],
];
DB.ingredients = ING_ROWS.map(([name, cat, emoji, kcal, p, c, f, pl, pg], i) => ({ id: `i${i + 1}`, name, cat, emoji, kcal, p, c, f, portion: { label: pl, g: pg }, source: 'elev8', ownerId: 'elev8', photo: '', hidden: false }));
DB.ingredients.push({ id: 'i90', name: 'Galette de sarrasin maison', cat: 'Personnalisé', emoji: '🥞', kcal: 160, p: 5.5, c: 30, f: 2, portion: { label: '1 galette', g: 60 }, source: 'coach', ownerId: 'c1', photo: '', hidden: false });
DB.ingredients.push({ id: 'i91', name: 'Protéine végétale (pois)', cat: 'Personnalisé', emoji: '', kcal: 370, p: 80, c: 3, f: 5, portion: { label: '1 dose', g: 30 }, source: 'coach', ownerId: 'c1', photo: '', hidden: false });
DB.ingredients.push({ id: 'i92', name: 'Barre « détox » miracle', cat: 'Personnalisé', emoji: '🍫', kcal: 12, p: 30, c: 2, f: 0, portion: { label: '1 barre', g: 40 }, source: 'coach', ownerId: 'c9', photo: '', hidden: false, flagged: true });
const IN = {}; DB.ingredients.forEach((x) => { IN[x.name] = x.id; });
const I = (name) => { if (!IN[name]) console.warn('Ingrédient inconnu', name); return IN[name]; };

const MENU_ROWS = [
  ['Petit-déjeuner protéiné', [['Flocons d’avoine', 60], ['Skyr nature', 150], ['Myrtilles', 80], ['Miel', 10]], 'Maintien', ['Végétarien'], 'Petit-déjeuner'],
  ['Bowl poulet, riz & brocoli', [['Blanc de poulet', 150], ['Riz basmati cuit', 180], ['Brocoli', 150], ['Huile d’olive', 10]], 'Prise de masse', ['Sans gluten', 'Sans lactose'], 'Déjeuner'],
  ['Déjeuner léger saumon-quinoa', [['Saumon', 120], ['Quinoa cuit', 120], ['Épinards', 80], ['Tomate', 100]], 'Perte de poids', ['Sans gluten', 'Sans lactose'], 'Déjeuner'],
  ['Omelette épinards & champignons', [['Œuf entier', 165], ['Épinards', 60], ['Champignons de Paris', 80], ['Pain complet', 35]], 'Maintien', ['Végétarien', 'Sans lactose'], 'Petit-déjeuner'],
  ['Collation banane & amandes', [['Banane', 120], ['Amandes', 25]], 'Prise de masse', ['Végan', 'Sans gluten', 'Sans lactose'], 'Collation'],
  ['Bowl végan lentilles & patate douce', [['Lentilles cuites', 200], ['Patate douce cuite', 150], ['Avocat', 70], ['Épinards', 50]], 'Maintien', ['Végan', 'Végétarien', 'Sans gluten', 'Sans lactose'], 'Déjeuner'],
  ['Dîner dinde, patate douce & haricots', [['Escalope de dinde', 150], ['Patate douce cuite', 200], ['Haricots verts', 150], ['Huile d’olive', 5]], 'Perte de poids', ['Sans gluten', 'Sans lactose'], 'Dîner'],
  ['Pancakes protéinés', [['Flocons d’avoine', 50], ['Œuf entier', 110], ['Protéine en poudre', 30], ['Banane', 60]], 'Prise de masse', ['Végétarien'], 'Petit-déjeuner'],
  ['Salade tomate-mozzarella', [['Tomate', 150], ['Mozzarella', 60], ['Huile d’olive', 10], ['Pain complet', 35]], 'Maintien', ['Végétarien'], 'Dîner'],
  ['Shake post-training', [['Protéine en poudre', 30], ['Lait demi-écrémé', 250], ['Banane', 120], ['Beurre de cacahuète', 16]], 'Prise de masse', ['Végétarien', 'Sans gluten'], 'Collation'],
  ['Crevettes sautées & riz', [['Crevettes', 150], ['Riz basmati cuit', 150], ['Poivron rouge', 100], ['Courgette', 100], ['Huile d’olive', 10]], 'Perte de poids', ['Sans gluten', 'Sans lactose'], 'Dîner'],
  ['Fromage blanc & fruits rouges', [['Fromage blanc 0 %', 200], ['Fraises', 100], ['Graines de chia', 10]], 'Perte de poids', ['Végétarien', 'Sans gluten'], 'Collation'],
  ['Steak, pommes de terre & haricots', [['Bœuf haché 5 %', 125], ['Pomme de terre cuite', 250], ['Haricots verts', 150]], 'Recomposition corporelle', ['Sans gluten', 'Sans lactose'], 'Dîner'],
  ['Tofu sauté & quinoa', [['Tofu ferme', 150], ['Quinoa cuit', 150], ['Brocoli', 120], ['Huile d’olive', 10]], 'Recomposition corporelle', ['Végan', 'Végétarien', 'Sans gluten', 'Sans lactose'], 'Déjeuner'],
];
DB.menus = MENU_ROWS.map(([name, items, goal, tags, meal], i) => ({ id: `m${i + 1}`, name, items: items.map(([n, g]) => ({ type: 'ing', id: I(n), g })), goal, tags, meal, source: 'elev8', ownerId: 'elev8', photo: '', hidden: false }));
DB.menus.push({ id: 'm90', name: 'Brunch du dimanche (Thomas)', items: [{ type: 'ing', id: I('Œuf entier'), g: 110 }, { type: 'ing', id: 'i90', g: 120 }, { type: 'ing', id: I('Avocat'), g: 70 }, { type: 'ing', id: I('Tomate'), g: 100 }], goal: 'Maintien', tags: ['Végétarien', 'Sans lactose'], meal: 'Petit-déjeuner', source: 'coach', ownerId: 'c1', photo: '', hidden: false });

const RECIPE_ROWS = [
  ['Overnight oats aux myrtilles', 'Facile', 5, 1, [['Flocons d’avoine', 50], ['Skyr nature', 150], ['Lait demi-écrémé', 100], ['Myrtilles', 80], ['Graines de chia', 10]], ['Mélanger les flocons, le skyr, le lait et le chia dans un bocal.', 'Ajouter les myrtilles sur le dessus.', 'Fermer et laisser une nuit au réfrigérateur.']],
  ['Poulet citron & riz basmati', 'Facile', 25, 2, [['Blanc de poulet', 300], ['Riz basmati cuit', 300], ['Brocoli', 300], ['Huile d’olive', 15]], ['Cuire le riz.', 'Saisir le poulet en lanières dans l’huile avec le zeste de citron.', 'Cuire le brocoli à la vapeur 6 min.', 'Servir avec un filet de citron.']],
  ['Saumon en papillote & légumes', 'Intermédiaire', 30, 2, [['Saumon', 250], ['Courgette', 200], ['Carotte', 150], ['Huile d’olive', 10], ['Pomme de terre cuite', 300]], ['Préchauffer le four à 200 °C.', 'Tailler les légumes en julienne.', 'Disposer saumon et légumes sur du papier cuisson, refermer.', 'Enfourner 18 min.']],
  ['Pancakes protéinés express', 'Facile', 15, 1, [['Flocons d’avoine', 50], ['Œuf entier', 110], ['Protéine en poudre', 30], ['Banane', 60]], ['Mixer tous les ingrédients.', 'Cuire de petites louches 1 min par face dans une poêle chaude.', 'Servir avec des fruits frais.']],
  ['Bowl lentilles & patate douce rôtie', 'Intermédiaire', 40, 2, [['Lentilles cuites', 400], ['Patate douce cuite', 300], ['Avocat', 140], ['Épinards', 100], ['Huile d’olive', 10]], ['Rôtir la patate douce en cubes 25 min à 210 °C.', 'Réchauffer les lentilles.', 'Dresser avec les épinards et l’avocat.']],
  ['Lasagnes de courgettes à la dinde', 'Difficile', 60, 4, [['Escalope de dinde', 500], ['Courgette', 800], ['Tomate', 400], ['Mozzarella', 125], ['Huile d’olive', 10]], ['Trancher finement les courgettes et les griller.', 'Préparer une sauce tomate avec la dinde hachée.', 'Monter les couches courgette / sauce / mozzarella.', 'Cuire 35 min à 180 °C.']],
  ['Omelette soufflée aux épinards', 'Intermédiaire', 15, 1, [['Œuf entier', 165], ['Épinards', 80], ['Emmental', 20]], ['Séparer les blancs des jaunes et monter les blancs.', 'Incorporer délicatement les jaunes et les épinards.', 'Cuire à feu doux à couvert 6 min.']],
  ['Energy balls amandes-chocolat', 'Facile', 15, 6, [['Amandes', 100], ['Flocons d’avoine', 80], ['Miel', 40], ['Chocolat noir 85 %', 30]], ['Mixer amandes et flocons.', 'Ajouter le miel et le chocolat fondu.', 'Former 12 boules et réserver au frais.']],
];
DB.recipes = RECIPE_ROWS.map(([name, difficulty, time, servings, items, steps], i) => ({ id: `r${i + 1}`, name, difficulty, time, servings, items: items.map(([n, g]) => ({ type: 'ing', id: I(n), g })), steps, source: 'elev8', ownerId: 'elev8', sharedWith: [], photo: '', hidden: false }));
DB.recipes.push({ id: 'r90', name: 'Galettes sarrasin complètes', difficulty: 'Intermédiaire', time: 20, servings: 2, items: [{ type: 'ing', id: 'i90', g: 120 }, { type: 'ing', id: I('Œuf entier'), g: 110 }, { type: 'ing', id: I('Emmental'), g: 40 }, { type: 'ing', id: I('Épinards'), g: 100 }], steps: ['Réchauffer les galettes.', 'Casser un œuf au centre, ajouter épinards et emmental.', 'Replier et servir.'], source: 'coach', ownerId: 'c1', sharedWith: ['a1', 'a3', 'a4', 'a8'], photo: '', hidden: false });
DB.recipes.push({ id: 'r91', name: 'Smoothie vert de Léa', difficulty: 'Facile', time: 5, servings: 1, items: [{ type: 'ing', id: I('Banane'), g: 120 }, { type: 'ing', id: I('Épinards'), g: 40 }, { type: 'ing', id: I('Protéine en poudre'), g: 30 }], steps: ['Tout mixer avec 200 ml d’eau froide.'], source: 'athlete', ownerId: 'a1', sharedWith: [], photo: '', hidden: false });
DB.recipes.push({ id: 'r92', name: 'Brownie protéiné « 0 calorie »', difficulty: 'Facile', time: 25, servings: 8, items: [{ type: 'ing', id: 'i92', g: 200 }], steps: ['Recette signalée : valeurs nutritionnelles irréalistes.'], source: 'coach', ownerId: 'c9', sharedWith: [], photo: '', hidden: false, flagged: true });
