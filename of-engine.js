// of-engine.js
// Moteur de génération d'Ordre de Fabrication (OF)
// = Logique métier pure, sans DOM, sans Firebase.
// Utilise les fiches techniques + commandes du chef
// pour calculer les besoins agrégés et l'ordre de lancement.

const TO_G = { g:1, kg:1000, ml:1, L:1000 };

/**
 * Génère un OF complet à partir des commandes.
 * @param {Array} commandes  [{ ficheId, quantite, unite: 'piece'|'kg'|'plaque' }]
 * @param {Array} fiches     Catalogue fiches techniques
 * @param {Object} opts      { debutMin: 540 (9h00 en minutes) }
 * @returns {Object}         OF complet, prêt à afficher ou imprimer
 */
export function genererOF(commandes, fiches, opts = {}){
  const debutMin = opts.debutMin ?? (9 * 60); // 9h00 par défaut
  const ficheMap = new Map(fiches.map(f => [f.id, f]));
  const besoins = new Map();
  const lignes = [];
  let coutTotal = 0;
  let tempsTotal = 0;

  for(const cmd of commandes){
    const f = ficheMap.get(cmd.ficheId);
    if(!f) continue;

    // 1) Calcul du facteur multiplicateur
    const stats = calcStats(f);
    let facteur = 0;
    if(cmd.unite === 'piece'){
      facteur = stats.nb > 0 ? cmd.quantite / stats.nb : 0;
    } else if(cmd.unite === 'kg'){
      facteur = stats.pate_g > 0 ? (cmd.quantite * 1000) / stats.pate_g : 0;
    } else if(cmd.unite === 'plaque'){
      facteur = cmd.quantite;
    }
    if(facteur <= 0) continue;

    // 2) Cumul des ingrédients (MRP)
    let coutFiche = 0;
    (f.ingredients || []).forEach(ing => {
      const qte_g = (Number(ing.qte) || 0) * (TO_G[ing.unite] || 1) * facteur;
      const cout  = qte_g / 1000 * (Number(ing.prix) || 0);
      const key   = String(ing.nom || '').trim().toLowerCase();
      if(!key) return;
      const cur = besoins.get(key) || { nom: ing.nom, qte_g: 0, cout: 0 };
      cur.qte_g += qte_g;
      cur.cout  += cout;
      besoins.set(key, cur);
      coutFiche += cout;
    });
    coutTotal += coutFiche;

    // 3) Temps de fabrication
    const tFiche = (f.etapes || []).reduce((s,e) => s + (Number(e.duree) || 0), 0);
    tempsTotal += tFiche * facteur;

    // 4) Temps de pousse (pointage + apprêt) → détermine l'ordre de lancement
    const tempsPousse = (f.etapes || [])
      .filter(e => e.type === 'pointage' || e.type === 'appret')
      .reduce((s,e) => s + (Number(e.duree) || 0), 0);

    lignes.push({
      ficheId: f.id,
      code: f.code,
      nomFr: f.nomFr,
      nomAr: f.nomAr || '',
      famille: f.famille,
      quantite: cmd.quantite,
      unite: cmd.unite,
      pieces: Math.round((stats.nb || 0) * facteur),
      pate_g: Math.round((stats.pate_g || 0) * facteur),
      cout: Math.round(coutFiche * 100) / 100,
      tempsPousse: Math.round(tempsPousse),
      tFiche: Math.round(tFiche),
      heureLancement: null
    });
  }

  // 5) Ordre de lancement : ce qui pousse le plus longtemps démarre le plus tôt
  const ordre = [...lignes].sort((a,b) => b.tempsPousse - a.tempsPousse);
  let curseur = debutMin;
  ordre.forEach(l => {
    l.heureLancement = curseur;
    curseur += l.tFiche + 15; // 15 min tampon entre produits
  });
  const finEstimee = curseur;

  // 6) Besoins formatés : g → kg si ≥ 1000
  const besoinsGlobaux = [...besoins.values()].map(b => ({
    nom: b.nom,
    qte_g: Math.round(b.qte_g),
    qte: b.qte_g >= 1000 ? Math.round(b.qte_g / 100) / 10 : Math.round(b.qte_g),
    unite: b.qte_g >= 1000 ? 'kg' : 'g',
    cout: Math.round(b.cout * 100) / 100
  })).sort((a,b) => b.qte_g - a.qte_g);

  // 7) Fusion lignes : on garde l'ordre de lancement pour l'affichage
  const lignesFinales = [...lignes].sort((a,b) => a.heureLancement - b.heureLancement);

  return {
    id: 'OF-' + new Date().toISOString().slice(0,10),
    date: new Date().toISOString(),
    lignes: lignesFinales,
    besoinsGlobaux,
    coutTotal: Math.round(coutTotal * 100) / 100,
    tempsTotal: Math.round(tempsTotal),
    finEstimee
  };
}

/** Extrait les stats d'une fiche (rendement, pâte totale) sans importer le module de calcul complet */
function calcStats(f){
  let pate_g = 0;
  (f.ingredients || []).forEach(i => {
    pate_g += (Number(i.qte) || 0) * (TO_G[i.unite] || 1);
  });
  const crue = Number(f.pieceCrue) || 0;
  const nb = crue > 0 ? Math.floor(pate_g / crue) : 0;
  return { pate_g, nb };
}

/** Formate les minutes depuis minuit en "HH:MM" */
export function hhmm(mn){
  const total = Math.round(mn);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
}

/** Formate une durée en minutes vers "Xh YYmin" */
export function duree(min){
  const t = Math.round(min);
  if(t < 60) return t + ' min';
  const h = Math.floor(t / 60);
  const m = t % 60;
  return h + 'h' + String(m).padStart(2,'0');
}
