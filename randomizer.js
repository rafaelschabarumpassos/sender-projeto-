// randomizer.js — versão leve, natural e segura

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// -----------------------------------------------------
// 1. PONTUAÇÃO LEVE (APENAS NO FINAL DE FRASE)
// -----------------------------------------------------
function randomPunctuation(text) {
  return text
    .split('\n')
    .map(line => {
      const trimmed = line.trim();

      // não tocar preços, datas, %, horas etc.
      if (
        /R\$/.test(trimmed) ||
        /%/.test(trimmed) ||
        /,\d{2}/.test(trimmed) ||
        /^\d/.test(trimmed) ||
        /\d{2}h\d{2}/i.test(trimmed)
      ) return line;

      // só mexer no final da linha
      const match = trimmed.match(/(\!|\.)$/);
      if (!match) return line;

      // chance de não alterar (naturalidade)
      if (Math.random() < 0.5) return line;

      const original = match[1];
      const change = original === '!' ? '.' : '!';

      return line.replace(/(\!|\.)$/, change);
    })
    .join('\n');
}

// -----------------------------------------------------
// 2. VARIAÇÃO DE EMOJIS LEVE
// -----------------------------------------------------
function randomEmojiSpaces(text) {

  // abertura 🎓
  text = text.replace(/🎓 *Você foi selecionado\(a\)! *🎓/g, () => {
    const versions = [
      '🎓 Você foi selecionado(a)! 🎓',
      '🎓  Você foi selecionado(a)! 🎓',
      '🎓Você foi selecionado(a)! 🎓'
    ];
    return pick(versions);
  });

  // 🚨 Atenção (1 variação leve)
  text = text.replace(/🚨 *Atenção/gi, () => {
    const versions = [
      '🚨 Atenção',
      '🚨Atenção'
    ];
    return pick(versions);
  });

  return text;
}

// -----------------------------------------------------
// 3. URGÊNCIA DINÂMICA
// -----------------------------------------------------
function randomUrgencia(text) {
  return text.replace(
    /Sua vaga é a número\s*\d+.*?restam apenas\s*\d+.*?23h59 de hoje/gi,
    () => {
      const x = Math.floor(Math.random() * 7) + 3;
      const y = Math.floor(Math.random() * 8) + 2;
      return `Sua vaga é a número ${x} — restam apenas ${y} disponíveis até 23h59 de hoje`;
    }
  );
}

// -----------------------------------------------------
// 4. DETECÇÃO DE TÍTULOS E BULLETS
// -----------------------------------------------------
function isBulletTitle(line) {
  const l = line.trim();
  return (
    (l.startsWith('📚') ||
     l.startsWith('🧠') ||
     l.startsWith('🎯')) &&
    l.endsWith(':')
  );
}

function isBulletLine(line) {
  const l = line.trim();
  return /^[\p{Emoji}\p{Extended_Pictographic}]\s+/u.test(l);
}

// -----------------------------------------------------
// 5. EMBARALHAMENTO LEVE DE BULLETS
// -----------------------------------------------------
function swapTwo(arr) {
  if (arr.length < 4) return arr; // não embaralhar blocos pequenos
  if (Math.random() > 0.4) return arr; // só às vezes (40%)

  const copy = arr.slice();
  const i = Math.floor(Math.random() * copy.length);
  let j = Math.floor(Math.random() * copy.length);
  while (j === i) j = Math.floor(Math.random() * copy.length);

  // troca leve de só 2 posições
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

function extractBulletBlocks(text) {
  const lines = text.split('\n');
  let result = [];

  let inside = false;
  let block = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isBulletTitle(line)) {
      if (inside && block.length) {
        result.push(...swapTwo(block));
        block = [];
      }
      inside = true;
      result.push(line);
      continue;
    }

    if (inside && isBulletLine(line)) {
      block.push(line);
      continue;
    }

    if (inside && !isBulletLine(line)) {
      if (block.length) {
        result.push(...swapTwo(block));
        block = [];
      }
      inside = false;
    }

    result.push(line);
  }

  if (inside && block.length) {
    result.push(...swapTwo(block));
  }

  return result.join('\n');
}

// -----------------------------------------------------
// 6. MASTER RANDOMIZER
// -----------------------------------------------------
module.exports = function (input) {
  let out = input;

  out = randomEmojiSpaces(out);
  out = randomPunctuation(out);
  out = randomUrgencia(out);
  out = extractBulletBlocks(out);

  return out;
};
