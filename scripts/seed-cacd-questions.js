/**
 * Seed script: CACD TPS real exam questions (C/E format → {a:Certo, b:Errado})
 * Each ITEM from each QUESTÃO becomes one row in the questions table.
 *
 * Usage: node scripts/seed-cacd-questions.js
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars (or use .env)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const OPCOES_CE = { a: 'Certo', b: 'Errado' };

// Helper: gabarito letter for a C/E answer
function ce(answer) { return answer === 'C' ? 'a' : 'b'; }

// ─────────────────────────────────────────────────────────────────────────────
// Question data. Format per entry:
//   { subject, topic, year, context, stem, items: [{ text, answer }] }
// context = shared passage/text for the question group
// stem    = instruction line (e.g. "Julgue os itens a seguir como C ou E")
// items   = array of 4 objects with item text and C/E answer
// ─────────────────────────────────────────────────────────────────────────────

const QUESTIONS = [

  // ══════════════════════════════════════════════════════════════════════════
  // CACD TPS 2023 – TARDE
  // ══════════════════════════════════════════════════════════════════════════

  // ── INGLÊS ──────────────────────────────────────────────────────────────

  {
    subject: 'Inglês', year: 2023,
    context: `Text: "OVER the past four centuries liberalism has been so successful that it has driven all its opponents off the battlefield. Now it is disintegrating, destroyed by a mix of hubris and internal contradictions, as professor Patrick Deneen claims in his recently published work Why Liberalism Failed. The gathering wreckage of liberalism's twilight years can be seen all around, especially in America, Mr Deneen's main focus. The founding tenets of the faith have been shattered. Equality of opportunity has produced a new meritocratic aristocracy that has all the aloofness of the old aristocracy with none of its sense of noblesse oblige. Democracy has degenerated into a theatre of the absurd. And technological advances are reducing ever more areas of work into meaningless drudgery. Mr Deneen uses the term 'liberalism' in its philosophical rather than its popular sense." (The Economist, 27 jan. 2018)`,
    stem: 'QUESTÃO 36 — As far as comprehension of the text above is concerned, mark the statements below as right (C) or wrong (E).',
    items: [
      { text: 'The new meritocratic aristocracy\'s distinguishing features are distancing or remoteness and a lack of moral and social responsibility.', answer: 'C' },
      { text: 'Meritocratic aristocracy is a mere construct, a contradiction in terms and therefore does not exist.', answer: 'E' },
      { text: 'Americans\' historical attachment to democratic values have prevented them from accepting the notion of an aristocracy, even if it has a democratic appearance.', answer: 'E' },
      { text: 'The prevailing view Americans hold of liberalism has departed significantly from that the historical political theorists had.', answer: 'C' },
    ],
  },

  {
    subject: 'Inglês', year: 2023,
    context: `(Same liberalism text — The Economist, 27 jan. 2018)`,
    stem: 'QUESTÃO 37 — As far as comprehension of the text above is concerned, mark the statements below as right (C) or wrong (E).',
    items: [
      { text: 'Historically, liberal values have failed to reflect the actual political and social reality for they are based on falsehoods.', answer: 'E' },
      { text: 'Mr Deneen\'s book provides a long-term analysis of the liberal phenomenon.', answer: 'C' },
      { text: 'An anti-religion movement swept across America and destroyed some people\'s belief in their Christian principles.', answer: 'E' },
      { text: 'From its inception liberalism could never live up to its promise of "creating a shared future in a fragmented world".', answer: 'E' },
    ],
  },

  {
    subject: 'Inglês', year: 2023,
    context: `(Same liberalism text — The Economist, 27 jan. 2018)`,
    stem: 'QUESTÃO 38 — As far as comprehension of the text above is concerned, mark the statements below as right (C) or wrong (E). [Vocabulary focus]',
    items: [
      { text: '"Hubris" means "unwillingness or incapacity to adapt or adjust".', answer: 'E' },
      { text: '"Wreckage" is synonymous with "speed".', answer: 'E' },
      { text: '"Twilight" can be correctly replaced with "a period of decline." (Note: gabarito altered to E — grammatical structure changes)', answer: 'E' },
      { text: '"Drudgery" means "boring, hard, routine work".', answer: 'C' },
    ],
  },

  {
    subject: 'Inglês', year: 2023,
    context: `(Same liberalism text — The Economist, 27 jan. 2018)`,
    stem: 'QUESTÃO 39 — As far as grammar is concerned, mark the statements below as right (C) or wrong (E).',
    items: [
      { text: 'The word "ever" can be correctly replaced with "increasingly", in this particular context, without effecting any change in the original meaning.', answer: 'C' },
      { text: 'The suffix "-ish" in "leftish" adds the notion of "somewhat or tending to" to the adjective "left".', answer: 'C' },
      { text: 'The word "this" (line 18) refers to "lie".', answer: 'E' },
      { text: 'The referent of the word "them" is "civil rights".', answer: 'E' },
    ],
  },

  {
    subject: 'Inglês', year: 2023,
    context: `Text: "Debating Diplomacy" — In the first decade of the twenty-first century, diplomacy came to be widely debated not only by practitioners, policy experts, and academics but also in the popular press and among the general public. One of the most significant debates concerned whether diplomacy had been or would be successful in preventing the Iraqi government of Saddam Hussein from possessing weapons of mass destruction. The US government of President George W. Bush and US allies were criticized for deciding on their own that multilateral diplomacy under the aegis of the United Nations had failed and hence to take military action against Iraq. (PIGMAN, Geoffrey Allen. In: KERR; WISEMAN. Diplomacy in a Globalizing World. Oxford: Oxford University Press, 2018)`,
    stem: 'QUESTÃO 40 — Considering the ideas and vocabulary presented in the text, mark the statements below as right (C) or wrong (E).',
    items: [
      { text: 'According to the author, the general public formed an opinion regarding the Iraqi situation having all the possible facts available.', answer: 'E' },
      { text: 'The author argues that the debate around diplomacy stems from the need to create an epistemological framework.', answer: 'E' },
      { text: '"Under the aegis of" is the same as to face strife.', answer: 'E' },
      { text: 'In the second paragraph, the word "underpinnings" means support, basis or basic structure.', answer: 'C' },
    ],
  },

  {
    subject: 'Inglês', year: 2023,
    context: `(Same "Debating Diplomacy" text — PIGMAN, Geoffrey Allen)`,
    stem: 'QUESTÃO 41 — Regarding the vocabulary of the text, mark the statements below as right (C) or wrong (E).',
    items: [
      { text: '"Irrespective of" could be replaced by "regardless of" without changing the meaning of the sentence.', answer: 'C' },
      { text: 'In the fragment "and hence to take military action against Iraq", the subject is the United Nations.', answer: 'E' },
      { text: 'The word "far-reaching" means "to have great influence or many effects".', answer: 'C' },
      { text: 'The word "apposite" could be replaced by "opposed" without changing the meaning of the sentence.', answer: 'E' },
    ],
  },

  // ── HISTÓRIA DO BRASIL ───────────────────────────────────────────────────

  {
    subject: 'História do Brasil', year: 2023,
    context: `"O barão do Rio Branco não veio para o Ministério como um ministro qualquer. Era já respeitado e admirado por suas duas vitórias arbitrais. [...] o historiador, o advogado do Brasil transformou-se em um estadista já nesse seu primeiro assunto, a mais grave questão de fronteira que o Brasil teve em sua história." (GOES FILHO, Synesio Sampaio. Navegantes, bandeirantes e diplomatas. Brasília: FUNAG, 2015)`,
    stem: 'QUESTÃO 45 — Considerando o texto precedente como referência inicial, julgue (C ou E) os itens a seguir.',
    items: [
      { text: 'Ao assumir a pasta das Relações Exteriores em dezembro de 1902, a situação estava em seu ponto crítico. No atual estado do Acre, viviam milhares de brasileiros, em sua maioria nordestinos, que, pela segunda vez em um lustro, haviam-se levantado com armas contra a Bolívia, a quem pertencia toda a área pelo acordo bilateral de limites de 1867.', answer: 'C' },
      { text: 'Somente depois da assinatura do tratado de 1867 é que os seringueiros brasileiros, sobretudo cearenses que fugiam das secas do Nordeste, foram entrando nessas regiões dos afluentes da margem sul do Amazonas, do Madeira, do Purus e do Juruá, onde se encontravam as maiores concentrações da Hevea brasiliensis.', answer: 'C' },
      { text: 'A Bolívia havia assumido, em 1901, um grande risco ao assinar um acordo com investidores ingleses e norte-americanos, que dava à empresa Bolivian Syndicate of New York City a completa administração do Acre, inclusive com poderes de polícia — uma espécie de chartered company.', answer: 'C' },
      { text: 'Em 17 de novembro de 1903, chegou-se ao Tratado de Petrópolis. O Brasil ficaria com metade do território do Acre (cerca de 95 mil km²), e a Bolívia receberia 2 milhões de libras esterlinas e se beneficiaria de três pequenos ajustes de fronteiras na região do rio Paraguai. Além disso, o Brasil se comprometia a construir a ferrovia Madeira-Mamoré.', answer: 'E' },
    ],
  },

  {
    subject: 'História do Brasil', year: 2023,
    context: `Sobre a política externa brasileira na década de 1960.`,
    stem: 'QUESTÃO 47 — No que concerne à política externa brasileira na década de 1960, julgue (C ou E) os itens a seguir.',
    items: [
      { text: 'No começo da década de 1960, intensificou-se o debate de política externa em torno de duas tendências: a americanista, que defendia o desenvolvimento associado e colocava ênfase na amizade com os EUA, e a nacional-desenvolvimentista ou independente, que pregava a mobilização nacional, a independência em relação aos EUA e a colaboração com os demais países em desenvolvimento.', answer: 'C' },
      { text: 'Na visão americanista, embora a rigidez da Guerra Fria nos anos de 1950 tivesse diminuído, o conflito leste-oeste deveria ser o tema central da política externa brasileira, por representar os ideais de liberdade, igualdade, fraternidade, humanismo, racionalismo, ciência e democracia.', answer: 'C' },
      { text: 'A política externa independente buscou obter vantagens para o Brasil no mundo bipolar, sublinhando a autodeterminação dos povos, diversificando relações diplomáticas, incorporando a Europa Oriental ao universo das relações brasileiras e assumindo liderança entre países em desenvolvimento — inspirando-se em líderes como Nasser, Tito e Nehru.', answer: 'C' },
      { text: 'A política externa independente revelou pragmatismo inédito nas relações internacionais do Brasil, permitindo adotar, para cada problema ou questão concreta, uma linha de conduta mais próxima dos objetivos traçados, sem ligação prévia com blocos de nações ou ideologias.', answer: 'E' },
    ],
  },

  {
    subject: 'História do Brasil', year: 2023,
    context: `Sobre o processo de emancipação política das mulheres no Brasil.`,
    stem: 'QUESTÃO 48 — Considerando o processo de emancipação política das mulheres no Brasil, julgue (C ou E) os itens a seguir.',
    items: [
      { text: 'Nísia Floresta Brasileira Augusta (1809–1885), comumente referida como a primeira feminista brasileira, promoveu debates sobre abolicionismo e republicanismo. Em 1832, traduziu o livro "A vindication of the rights of woman", de Mary Wollstonecraft, com o título "Direitos das mulheres e injustiças dos homens".', answer: 'C' },
      { text: 'Em 1910, foi fundado o Partido Republicano Feminino (PRF), presidido por Leolinda de Figueiredo Daltro, cujo principal pleito era a abertura dos cargos públicos a todos os brasileiros, independentemente de sexo.', answer: 'C' },
      { text: 'Em 1919, Bertha Lutz representou o Brasil na reunião do Conselho Feminino da Organização Internacional do Trabalho. Em 1922, participou da primeira Conferência Panamericana de Mulheres, ocorrida em Baltimore, EUA.', answer: 'C' },
      { text: 'Nas eleições para a Constituinte de 1933, Bertha Lutz foi eleita, sendo a primeira deputada federal do Brasil e única representante do sexo feminino na Constituinte de 1933/1934.', answer: 'E' },
    ],
  },

  {
    subject: 'História do Brasil', year: 2023,
    context: `"A partir de agosto de 1820, o Reino Unido de Portugal, Brasil e Algarves foi sacudido por um movimento que minou os últimos pilares do Antigo Regime luso-brasileiro. Centrado na defesa do constitucionalismo e na oposição ao despotismo, o movimento se irradiou de Portugal para o Brasil, levando à constituição de Juntas Provisórias de governo, ao retorno de d. João VI para Lisboa e à emergência de debates e de projetos distintos de organização do Reino Unido." (VILLALTA, Luiz Carlos. O Brasil e a crise do Antigo Regime português (1788–1822). Rio de Janeiro: Editora FGV, 2016)`,
    stem: 'QUESTÃO 49 — Acerca dos anos 1820–1822 e da emancipação do Brasil, julgue (C ou E) os itens a seguir.',
    items: [
      { text: 'A partir do Rio de Janeiro, com a integração de São Paulo e Minas Gerais, um movimento, nacional na essência, aglutinou e consolidou, sem maiores embaraços, a aliança entre as diversas forças políticas do restante da América portuguesa.', answer: 'E' },
      { text: 'Para parte das elites coloniais, as ideias do constitucionalismo liberal foram aclimatadas com vistas a aniquilar o residual e subjacente estatuto colonial e fortalecer a autonomia das províncias, inclusive dentro dos quadros do Reino Unido e sob uma monarquia constitucional.', answer: 'C' },
      { text: 'Em províncias como Bahia, Pernambuco, Rio de Janeiro e Pará, a elite colonial queria restabelecer a centralidade geopolítica e econômica de Lisboa no conjunto do Império.', answer: 'E' },
      { text: 'Em Pernambuco, um arraigado sentimento de repulsa com o governo do Rio de Janeiro inviabilizou a adesão dessa província ao projeto separatista liderado pelo príncipe d. Pedro em 1822.', answer: 'E' },
    ],
  },

  {
    subject: 'História do Brasil', year: 2023,
    context: `Sobre os processos econômicos e sociopolíticos brasileiros durante o Estado Novo (1937–1945). Referência: "A luta indígena no coração do Brasil" (GARFIELD, Seth. São Paulo: Editora Unesp, 2011).`,
    stem: 'QUESTÃO 51 — Acerca dos processos econômicos e sociopolíticos brasileiros durante o Estado Novo (1937–1945), julgue (C ou E) os itens a seguir.',
    items: [
      { text: 'O Dia do Trabalho, comemorado a partir de 1939 no estádio de São Januário, no Rio de Janeiro, foi peça-chave no calendário estadonovista, mas a adesão ao evento pela massa de trabalhadores urbanos ficou aquém do esperado, já que o populismo e o autoritarismo varguistas frustraram os sindicatos.', answer: 'E' },
      { text: 'O Estado Novo ultrapassou as tentativas republicanas anteriores de expansão pelo Brasil Central. A industrialização e a extensão da legislação trabalhista provocaram o aumento da urbanização, e o Regime Vargas promoveu a povoação do interior da região Centro-Oeste.', answer: 'C' },
      { text: 'A proteção jurídica conquistada pelos trabalhadores no decorrer do Estado Novo (1937–1945) não teve relação com reivindicações grevistas e lutas sindicais anteriores, devendo ser creditada apenas ao intervencionismo estatal nesse período.', answer: 'E' },
      { text: 'Entre as estratégias da propaganda estadonovista, o programa radiofônico "Hora do Brasil" foi criado para ser um sucesso de audiência, e sua transmissão tornou-se obrigatória em todos os estabelecimentos comerciais que possuíssem aparelho de radiodifusão.', answer: 'C' },
    ],
  },

  {
    subject: 'História do Brasil', year: 2023,
    context: `Sobre a presença da família real portuguesa no Brasil.`,
    stem: 'QUESTÃO 53 — A respeito da presença da família real portuguesa no Brasil, julgue (C ou E) os itens a seguir.',
    items: [
      { text: 'A vinda de d. João e de sua corte ao Brasil justificou-se pela necessidade de exercer maior controle da fiscalização e coleta de impostos da exploração aurífera em Minas Gerais, espaço que fornecia, por intermédio do contrabando de metais preciosos, um alto volume de ouro sem lastro para a Europa.', answer: 'E' },
      { text: 'A chegada da família real ao Brasil permitiu uma nova orientação das relações entre colônia e metrópole, graças ao aumento da importância do Rio de Janeiro — confirmada pela implantação de órgãos da justiça lusitana, como a Casa de Suplicação, e pela instalação de equipamentos urbanos como o Jardim Botânico e a Real Academia Militar.', answer: 'C' },
      { text: 'A criação do Reino Unido de Portugal, Brasil e Algarves em 1815 foi fundamental para a consolidação da posição da colônia frente aos negócios do império português, ocasionando dúvidas em torno da permanência da família real na América entre políticos portugueses. (Gabarito alterado para E.)', answer: 'E' },
      { text: 'A presença lusitana no Brasil e as ações despóticas de d. João VI contribuíram para a adoção de um forte sentimento republicano entre comerciantes luso-brasileiros, o que teve por consequência a expulsão da família real portuguesa dos territórios do Brasil em 1822.', answer: 'E' },
    ],
  },

  {
    subject: 'História do Brasil', year: 2023,
    context: `"A Constituição Federal de 1988 institucionalizou o processo democrático ocorrido a partir de 1985 no Brasil, introduzindo grandes alterações no panorama político-partidário e na sociedade como um todo."`,
    stem: 'QUESTÃO 55 — No que concerne a essas alterações, julgue (C ou E) os itens a seguir.',
    items: [
      { text: 'A Constituição de 1988 resultou de um processo de transição do regime militar em direção a um ordenamento político e social democrático. Ao deparar com grandes desigualdades, o ordenamento jurídico promoveu mudanças nas políticas sociais no sentido de maior inclusão econômica e social.', answer: 'C' },
      { text: 'Os debates que antecederam a promulgação da Constituição de 1988, apesar de inflamados, desconsideraram o tema da forma de governo a ser adotada. A justificativa mais corrente possuía como referência a necessidade de extirpar o chamado "entulho autoritário".', answer: 'E' },
      { text: 'A Constituição brasileira de 1988 manteve inalterada a base institucional que orienta o funcionamento do sistema político. O Legislativo ganhou força em detrimento do Executivo, e as prerrogativas legislativas do Executivo foram minimizadas.', answer: 'E' },
      { text: 'Com a Constituição de 1988, uma nova ordem institucional foi estabelecida, orientada pelos princípios da participação popular ampla e da descentralização tributária para estados e municípios, resultando em novo federalismo que redistribuiu poderes político e financeiro em âmbito nacional.', answer: 'C' },
    ],
  },

  // ── HISTÓRIA MUNDIAL ─────────────────────────────────────────────────────

  {
    subject: 'História Mundial', year: 2023,
    context: `"A Liga está morta. Viva as Nações Unidas!" — Discurso do representante do Reino Unido, Robert Cecil, à sessão final da Assembleia da Liga das Nações, 18 de abril de 1946.`,
    stem: 'QUESTÃO 58 — Considerando o funcionamento, o processo de enfraquecimento e a dissolução final da Liga das Nações, julgue (C ou E) os itens a seguir.',
    items: [
      { text: 'Apesar da ênfase dada à atuação política, o Pacto da Liga das Nações estabelecia compromissos relativos à garantia de condições humanas para o trabalho, ao tratamento justo dos nacionais, à manutenção da liberdade de comunicação e trânsito e à prevenção e ao controle de doenças.', answer: 'C' },
      { text: 'A crise política que levou à II Grande Guerra causou a dissolução da Liga das Nações e de todos os órgãos e das agências multilaterais a ela associados, e as potências aliadas julgaram necessário criar novos regimes e organizações multilaterais.', answer: 'E' },
      { text: 'O primeiro programa de cooperação para o desenvolvimento em âmbito multilateral foi implementado sob os auspícios da Liga das Nações e teve como seu beneficiário a China, um membro pleno da Liga, e não um dos territórios coloniais mantidos sob o sistema de Mandatos.', answer: 'C' },
      { text: 'A mais ambiciosa proposta de reforma institucional da Liga — o relatório Bruce — tencionava ampliar o escopo de atuação da organização nos temas econômicos e sociais como forma de contrarrestar a perda de relevância política ao longo da década de 1930. O projeto foi frustrado pela invasão da Polônia pelas tropas alemãs dias após sua apresentação.', answer: 'C' },
    ],
  },

  {
    subject: 'História Mundial', year: 2023,
    context: `Sobre o processo de unificação alemão e a dimensão de seu empreendimento colonial entre os anos de 1884 e 1899.`,
    stem: 'QUESTÃO 61 — Julgue (C ou E) os itens a seguir.',
    items: [
      { text: 'Bismarck havia se colocado inicialmente contra a colonização, dados os altos custos e riscos. Sua mudança de posição, em 1884, está associada a fatores internos, como a necessidade de deslocar tensões socioeconômicas para os domínios coloniais, e a externos, sobretudo a capacidade de interferir nas disputas entre outras potências. Bismarck preferia designar as possessões alemãs de "protetorados", optando por um modelo de dominação inspirado em iniciativas comerciais privadas com apoio estatal.', answer: 'C' },
      { text: 'Os recursos destinados a missionários foram cruciais para a colonização alemã no continente africano, o que se deu com a autorização para a formação de sociedades missionárias católicas na Alemanha após os conflitos ligados à chamada Kulturkampf, no início dos anos de 1870.', answer: 'E' },
      { text: 'A geografia foi um dos principais instrumentos da cultura colonial alemã, nacionalizando-se com a criação, em 1892, da disciplina "geografia das colônias alemãs", difundida no sistema escolar. Em 1899, o relato da visita ao monte Kilimanjaro por Hans Meyer foi descrito como a chegada à "montanha mais alta do país".', answer: 'C' },
      { text: 'Uma das consequências do imperialismo alemão foi a correlação entre práticas de dominação nos territórios ocupados e aquelas empregadas em grupos minoritários na Europa. Os grupos foram igualmente tidos por "infantis" e "selvagens" e alvo de instituições que atuavam segundo procedimentos semelhantes, geralmente amparados na ideia de "educação para o trabalho".', answer: 'C' },
    ],
  },

  {
    subject: 'História Mundial', year: 2023,
    context: `Sobre o desenvolvimento do capitalismo no século 19.`,
    stem: 'QUESTÃO 64 — A respeito do desenvolvimento do capitalismo no século 19, julgue (C ou E) os itens a seguir.',
    items: [
      { text: 'Os produtos característicos daquele período foram o ferro e o carvão, e o símbolo que os combinava, a estrada de ferro. O total mundial de vias férreas aumentou cerca de 50 vezes entre 1840 e 1880, com expansão das redes ferroviárias, principalmente na Europa e nos EUA.', answer: 'C' },
      { text: 'A industrialização germânica foi tardia em razão do contexto político da unificação. Mesmo com o número de habitantes semelhante ao da França, sua capacidade industrial era incomparavelmente menor que a francesa ao longo de todo o século 19.', answer: 'E' },
      { text: 'Entre o final da década de 1840 e meados da década de 1870, o capitalismo industrial tornou-se uma economia global, e o setor financeiro passou a se integrar mundialmente. Com isso, a crise que se iniciou em 1873 foi a mais intensa do século pelos efeitos em escala mundial.', answer: 'C' },
      { text: 'Nos EUA, a crise de 1873 foi um dos grandes temas de debate nas eleições presidenciais de 1876. Na ocasião, o Partido Republicano acusou os democratas de "imbecilidade financeira", por causa das altas tarifas protecionistas que impediam a recuperação econômica do país.', answer: 'E' },
    ],
  },

  {
    subject: 'História Mundial', year: 2023,
    context: `Sobre os eventos da Crise de 1929 e da Grande Depressão.`,
    stem: 'QUESTÃO 65 — Acerca dos eventos da Crise de 1929 e da Grande Depressão, julgue (C ou E) os itens a seguir.',
    items: [
      { text: 'O crescimento econômico nos EUA foi generalizado durante toda a década de 1920, alcançando todos os setores da economia, e somente decaiu após o colapso da bolsa de Nova York em outubro de 1929.', answer: 'E' },
      { text: 'Uma das causas da Crise de 1929 nos EUA foi a desorganização dos bancos. Com a expansão do crédito no período anterior, a redução abrupta dos depósitos com o colapso econômico levou a uma generalizada falência bancária.', answer: 'C' },
      { text: 'O que garantiu, de forma definitiva, a vitória de Franklin D. Roosevelt nas eleições presidenciais de 1932 foi o programa econômico detalhado do Partido Democrata, apresentado na plataforma de campanha, que consistia em políticas anticíclicas para combater a Depressão.', answer: 'E' },
      { text: 'O conjunto de políticas de reajuste econômico de Roosevelt foi chamado de "New Deal" e incluiu medidas para recuperação da confiabilidade dos bancos, subsídios governamentais para a agricultura e programas de obras públicas para restabelecer os níveis de emprego.', answer: 'C' },
    ],
  },

  {
    subject: 'História Mundial', year: 2023,
    context: `Sobre os eventos da Guerra Fria nas décadas de 1970 e de 1980.`,
    stem: 'QUESTÃO 66 — Com relação aos eventos da Guerra Fria nas décadas de 1970 e de 1980, julgue (C ou E) os itens a seguir.',
    items: [
      { text: 'Um dos resultados do acordo de Helsinque, assinado em 1975, foi o reconhecimento do controle soviético na Europa Oriental. Apesar de abordar aspectos de direitos humanos, à época, o acordo foi muito criticado nos EUA.', answer: 'C' },
      { text: 'Um dos pontos centrais da détente era o esforço soviético-americano para limitar a corrida armamentista nuclear.', answer: 'E' },
      { text: 'Ronald Reagan, eleito presidente em 1980, declarou a URSS um "Império do Mal". Em 1983, o programa "Star Wars" (SDI) foi anunciado, com o propósito de proteger os EUA de mísseis soviéticos por meio de lasers e satélites.', answer: 'C' },
      { text: 'A Aliança, como forma de intimidar a URSS, impôs limites a algumas rodadas do acordo SALT, e a recessão verificada no início da década de 1980 contribuiu para que a economia soviética parasse de crescer.', answer: 'C' },
    ],
  },

  // ── ECONOMIA ─────────────────────────────────────────────────────────────

  {
    subject: 'Economia', year: 2023,
    context: `Sobre o pensamento econômico da CEPAL e o desenvolvimento econômico latino-americano.`,
    stem: 'QUESTÃO 67 — Acerca dos desenvolvimentos do pensamento econômico latino-americano influenciado pela Cepal, julgue (C ou E) os itens a seguir.',
    items: [
      { text: 'Nas décadas de 1940 e de 1950, o debate econômico no mundo focava-se na atuação do Estado e no incentivo ao uso de poupança ociosa, enquanto, na América Latina, esse foco era mais voltado para o protecionismo.', answer: 'C' },
      { text: 'O pensamento cepalino não apresenta semelhanças com o pensamento keynesiano surgido na década de 1930, tendo em vista que a condição de subdesenvolvimento da América Latina exigia uma refutação completa da teoria econômica concebida em países desenvolvidos.', answer: 'E' },
      { text: 'O desequilíbrio estrutural do balanço de pagamentos é apontado pela Cepal como uma das consequências do livre comércio e pode ser considerado justificativa para as medidas cambiais menos ortodoxas utilizadas no Brasil nas décadas de 1940 e de 1950.', answer: 'C' },
      { text: 'A noção de centro-periferia está relacionada, no plano interno, com a existência de um setor exportador de alta produtividade e por setores de baixa produtividade no restante das economias latino-americanas.', answer: 'E' },
    ],
  },

  {
    subject: 'Economia', year: 2023,
    context: `Sobre os bancos digitais e o mercado bancário mundial e brasileiro, tendência acentuada com a pandemia da Covid-19.`,
    stem: 'QUESTÃO 69 — Considerando os seus conhecimentos acerca de bancos digitais, julgue (C ou E) os itens a seguir.',
    items: [
      { text: 'Uma das características dos bancos digitais é a isenção de acompanhamento regulatório pelo Banco Central do Brasil.', answer: 'E' },
      { text: 'Um banco digital necessariamente deverá ser constituído como um banco comercial.', answer: 'E' },
      { text: 'A categoria de banco digital reflete decisões operacionais e mercadológicas de cada banco, como o acesso exclusivamente remoto e a busca por redução de tarifas. Dessa forma, bancos tradicionais também podem se inserir nesse segmento.', answer: 'C' },
      { text: 'O advento de bancos digitais no mercado financeiro brasileiro levou a um aumento de concentração e redução da concorrência no segmento bancário.', answer: 'E' },
    ],
  },

  {
    subject: 'Economia', year: 2023,
    context: `"Os anos iniciais da Primeira República foram de transformações estruturais para a economia brasileira. A adoção do trabalho assalariado no campo, o aumento da inserção do Brasil no comércio internacional, estimulado pelo café, e a crescente diversificação da economia levaram ao aprofundamento das relações econômico-financeiras do Brasil com o exterior."`,
    stem: 'QUESTÃO 73 — Considerando essa informação e os principais fatos e características da economia brasileira no período mencionado, julgue (C ou E) os itens a seguir.',
    items: [
      { text: 'A crescente inserção do Brasil no comércio internacional, impulsionada pelo café, desencadeou mudanças importantes na política econômica, que passou a lidar com uma progressiva deterioração das contas externas brasileiras em consequência da manutenção do câmbio fixo durante todo o período em tela.', answer: 'E' },
      { text: 'A participação do Brasil no investimento internacional contou com a presença crescente do capital estrangeiro no País por meio do investimento direto e do investimento de carteira. Esses investimentos contribuíram para que a conta de capital fosse capaz de compensar a instabilidade da receita comercial no contexto das contas externas.', answer: 'C' },
      { text: 'A política de manutenção da rentabilidade da cafeicultura levou à contratação de empréstimos de curto prazo, feita em moeda forte pelo Estado brasileiro, para lidar com o enfraquecimento do preço internacional do café. Essa queda de preço resultou, antes de tudo, da desaceleração da demanda internacional por esse produto.', answer: 'E' },
      { text: 'A introdução do trabalho assalariado no campo implicou novas demandas típicas de trabalho livre, como a oferta sazonal de crédito para as lavouras e pagamentos de salários. Essa procura por moeda exigia mudança na política monetária que, ao contrário, estava comprometida em reduzir a oferta de moeda com o objetivo de o País voltar a aderir ao padrão-ouro. (Gabarito alterado para E.)', answer: 'E' },
    ],
  },

];

// ─────────────────────────────────────────────────────────────────────────────
// Build flat list of DB rows
// ─────────────────────────────────────────────────────────────────────────────

function buildRows(questions) {
  const rows = [];
  for (const q of questions) {
    q.items.forEach((item, idx) => {
      rows.push({
        source: 'exam',
        subject: q.subject,
        topic: `CACD TPS ${q.year}`,
        enunciado: [
          q.context ? `[Contexto]\n${q.context}` : null,
          q.stem,
          `Item ${idx + 1}: ${item.text}`,
        ].filter(Boolean).join('\n\n'),
        opcoes: OPCOES_CE,
        gabarito: ce(item.answer),
        explicacao: null,
      });
    });
  }
  return rows;
}

async function main() {
  const rows = buildRows(QUESTIONS);
  console.log(`Inserting ${rows.length} questions…`);

  // Insert in batches of 50 to avoid request limits
  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { data, error } = await supabase.from('questions').insert(batch).select('id');
    if (error) {
      console.error(`Batch ${i / BATCH + 1} failed:`, error.message);
    } else {
      inserted += data.length;
      console.log(`  batch ${i / BATCH + 1}: inserted ${data.length} rows`);
    }
  }

  console.log(`\nDone. ${inserted}/${rows.length} questions inserted.`);
}

main().catch(err => { console.error(err); process.exit(1); });
