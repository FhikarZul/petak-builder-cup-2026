import { expect, it } from 'vitest';
import { inlineEmphasis, neighbourKeywords } from './inlineEmphasis';
it('renders marked settings as emphasis without displaying markdown markers', () => {
  expect(inlineEmphasis('Using **SGD** and **Singapore time**.')).toEqual([
    { text: 'Using ', bold: false }, { text: 'SGD', bold: true },
    { text: ' and ', bold: false }, { text: 'Singapore time', bold: true }, { text: '.', bold: false },
  ]);
});
it('emphasizes only the filing category at the end, never the same word in a merchant', () => {
  expect(inlineEmphasis('Filed. Drinks Stand — S$11.60 · Drinks.', 'Drinks')).toEqual([
    { text: 'Filed. Drinks Stand — S$11.60 · ', bold: false },
    { text: 'Drinks', bold: true }, { text: '.', bold: false },
  ]);
  expect(inlineEmphasis('Drinks Stand', 'Drinks')).toEqual([{ text: 'Drinks Stand', bold: false }]);
});
it('keeps unmatched markers literal', () => {
  expect(inlineEmphasis('cost **unknown')).toEqual([{ text: 'cost **unknown', bold: false }]);
});
it('emphasizes the typed leading category in Penny filing copy, not the same merchant word', () => {
  expect(inlineEmphasis('Filed. Groceries — 9.53 SGD at Groceries Mart. Suggested category.', 'Groceries')).toEqual([
    {text:'Filed. ',bold:false},{text:'Groceries',bold:true},
    {text:' — 9.53 SGD at Groceries Mart. Suggested category.',bold:false},
  ]);
  expect(inlineEmphasis('Filed. Groceries Mart — 9.53 SGD.', 'Groceries').some(p=>p.bold)).toBe(false);
  expect(inlineEmphasis("Filed — S$9.53 at Shop, under groceries. My guess on the category — say if it's wrong.", 'Groceries')).toEqual([
    { text: "Filed — S$9.53 at Shop, under ", bold: false },
    { text: 'groceries', bold: true },
    { text: ". My guess on the category — say if it's wrong.", bold: false },
  ]);
});
it('uses structured meal, goal and action facts for whole-word emphasis', () => {
  const words=neighbourKeywords([
    {kind:'meal_detail',dish:'Chicken rice'},
    {kind:'objective_table',new:{protein_g:137,calories:1338}},
    {kind:'task_actions',labels:['Use these']},
  ] as import('./blocks').MessageBlock[]);
  const parts=inlineEmphasis('Chicken rice logged. Protein is 137 g; proteinase is not a macro. Use these.',undefined,words);
  expect(parts.filter(p=>p.bold).map(p=>p.text)).toEqual(['Chicken rice','Protein','Use these']);
  expect(parts.map(p=>p.text).join('')).toBe('Chicken rice logged. Protein is 137 g; proteinase is not a macro. Use these.');
});
it('does not emphasize a merchant merely because it is an entry title',()=>{
  const words=neighbourKeywords([{kind:'entry_card',entryKind:'expense',title:'Protein Shop'}] as import('./blocks').MessageBlock[]);
  expect(inlineEmphasis('Protein Shop filed.',undefined,words)).toEqual([{text:'Protein Shop filed.',bold:false}]);
});
it('keeps existing strong category markers from being nested or exposed',()=>{
  expect(inlineEmphasis('Filed under **Groceries**.', 'Groceries')).toEqual([{text:'Filed under ',bold:false},{text:'Groceries',bold:true},{text:'.',bold:false}]);
});
it('keeps marked amounts in Jakarta while selected words use the branded face', async () => {
  const { keywordStyle } = await import('./inlineEmphasis');
  expect(keywordStyle('Dining Out')).toMatchObject({fontFamily:'Petak Pixel Bold',fontSize:20});
  for (const amount of ['S$24.50','24.50 SGD','€10','137 g']) expect(keywordStyle(amount).fontFamily).toBe('PlusJakartaSans_500Medium');
});
