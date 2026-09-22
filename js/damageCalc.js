// Lógica de cálculo para la Calculadora de Daño. Son funciones puras (no
// tocan `state`) para que sean fáciles de testear y de reutilizar tanto
// desde el render como desde los cálculos de "energías que faltan".

// ---- Ogerpon Máscara Turquesa ex ----
// Daño: 30 + 30 por cada energía unida a Ogerpon (propia) y por cada
// energía unida al Pokémon rival. Si hay un Meganium (no-Mega) en la
// banca, las energías propias cuentan x2 (las del rival no se duplican).
// Si hay ventaja de tipo, el total se duplica al final.
export function ogerponDamage({ myEnergy, rivalEnergy, meganiumBench, typeAdvantage }){
  const myCount = myEnergy * (meganiumBench ? 2 : 1);
  const base = 30 + 30 * (myCount + rivalEnergy);
  return typeAdvantage ? base * 2 : base;
}

// ---- Mega Meganium ----
// Daño: 70 + 50 por cada energía unida a Mega Meganium. Las energías del
// rival no afectan a este ataque. Ventaja de tipo duplica el total.
export function meganiumDamage({ myEnergy, typeAdvantage }){
  const base = 70 + 50 * myEnergy;
  return typeAdvantage ? base * 2 : base;
}

// Busca el menor número de energías adicionales (>=0) que hay que sumar a
// `current` para que `damageFn(current + n)` alcance `targetHp`. Devuelve
// null si no se alcanza dentro de un rango razonable (no debería pasar en
// la práctica, pero evita un bucle infinito si el objetivo es absurdo).
function extraNeeded(damageFn, current, targetHp, maxExtra = 200){
  if(damageFn(current) >= targetHp) return 0;
  for(let n = 1; n <= maxExtra; n++){
    if(damageFn(current + n) >= targetHp) return n;
  }
  return null;
}

// Para Ogerpon hay dos preguntas independientes: "si solo subo mis
// energías, ¿cuántas más me faltan?" y "si solo subo las del rival,
// ¿cuántas más faltan?" (cada una asume que la otra se queda como está).
export function ogerponEnergyNeeded({ myEnergy, rivalEnergy, meganiumBench, typeAdvantage, rivalHp }){
  const hp = Number(rivalHp);
  if(!rivalHp || !Number.isFinite(hp) || hp <= 0) return null;

  const extraMine = extraNeeded(
    n => ogerponDamage({ myEnergy: n, rivalEnergy, meganiumBench, typeAdvantage }),
    myEnergy, hp
  );
  const extraRival = extraNeeded(
    n => ogerponDamage({ myEnergy, rivalEnergy: n, meganiumBench, typeAdvantage }),
    rivalEnergy, hp
  );

  return { extraMine, extraRival };
}

export function meganiumEnergyNeeded({ myEnergy, typeAdvantage, rivalHp }){
  const hp = Number(rivalHp);
  if(!rivalHp || !Number.isFinite(hp) || hp <= 0) return null;

  const extraMine = extraNeeded(
    n => meganiumDamage({ myEnergy: n, typeAdvantage }),
    myEnergy, hp
  );

  return { extraMine };
}
