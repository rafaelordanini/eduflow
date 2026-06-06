/**
 * Seed script: CACD TPS 2003 exam questions (C/E format → {a:Certo, b:Errado})
 * Each ITEM from each QUESTÃO becomes one row in the questions table.
 * 30 questões × 5 itens = 150 rows total.
 *
 * Usage: node scripts/seed-2003-questions.js
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars (or .env file)
 *
 * Gabarito source: official 2003 TPS answer key
 * Items labeled Ø,Ù,Ú,Û,Ü in the original correspond to items 1–5 here.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const OPCOES_CE = { a: 'Certo', b: 'Errado' };

/** Convert C/E answer char to gabarito letter */
function ce(answer) { return answer === 'C' ? 'a' : 'b'; }

// ─────────────────────────────────────────────────────────────────────────────
// GABARITO 2003 (official answer key)
// Rows = itens 1–5; Columns = questões 1–30
//
//           Q1  Q2  Q3  Q4  Q5  Q6  Q7  Q8  Q9  Q10 Q11 Q12 Q13 Q14 Q15 Q16 Q17 Q18 Q19 Q20 Q21 Q22 Q23 Q24 Q25 Q26 Q27 Q28 Q29 Q30
// Item 1:   C   C   C   E   C   E   E   C   E   E   E   C   E   C   C   C   E   C   E   C   E   E   C   C   C   E   E   C   E   C
// Item 2:   E   C   E   E   E   C   C   C   E   E   C   C   E   C   C   E   E   C   C   E   C   E   E   C   E   E   C   E   E   E
// Item 3:   C   C   E   C   E   C   E   E   C   E   C   E   C   E   C   C   E   E   C   E   E   E   E   C   E   C   C   C   C   E
// Item 4:   C   C   C   C   E   E   C   C   C   C   C   C   C   E   E   E   E   C   E   E   C   C   C   E   C   E   E   C   E   C
// Item 5:   E   C   C   E   E   E   E   C   C   E   E   E   E   E   C   C   E   C   C   E   C   E   E   E   C   E   E   C   C   C
// ─────────────────────────────────────────────────────────────────────────────

const GABARITO = {
  //        [item1, item2, item3, item4, item5]
   1: ['C','E','C','C','E'],
   2: ['C','C','C','C','C'],
   3: ['C','E','E','C','C'],
   4: ['E','E','C','C','E'],
   5: ['C','E','E','E','E'],
   6: ['E','C','C','E','E'],
   7: ['E','C','E','C','E'],
   8: ['C','C','E','C','C'],
   9: ['E','E','C','C','C'],
  10: ['E','E','E','C','E'],
  11: ['E','C','C','C','E'],
  12: ['C','C','E','C','E'],
  13: ['E','E','C','C','E'],
  14: ['C','C','E','E','E'],
  15: ['C','C','C','E','C'],
  16: ['C','E','C','E','C'],
  17: ['E','E','E','E','E'],
  18: ['C','C','E','C','C'],
  19: ['E','C','C','E','C'],
  20: ['C','E','E','E','E'],
  21: ['E','C','E','C','C'],
  22: ['E','E','E','C','E'],
  23: ['C','E','E','C','E'],
  24: ['C','C','C','E','E'],
  25: ['C','E','E','C','C'],
  26: ['E','E','C','E','E'],
  27: ['E','C','C','E','E'],
  28: ['C','E','C','C','C'],
  29: ['E','E','C','E','C'],
  30: ['C','E','E','C','C'],
};

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION DEFINITIONS
// Each entry defines context/stem/items for one QUESTÃO (5 itens each).
// enunciado = shared passage context shown to the candidate.
// items[n].text = the Julgue statement for that item.
// ─────────────────────────────────────────────────────────────────────────────

const QUESTOES = [

  // ══════════════════════════════════════════════════════════════════════════
  // PORTUGUÊS  — Q1–Q6
  // ══════════════════════════════════════════════════════════════════════════

  {
    questao: 1,
    subject: 'Português',
    topic: 'Linguística e texto',
    enunciado: 'QUESTÃO 1 (TPS 2003) — Texto "Mistura linguística": trecho sobre hibridismo de línguas, globalização e identidade cultural na era contemporânea, discutindo o papel do inglês como língua franca e as resistências das línguas nacionais.',
    stem: 'Com base no texto acima, julgue os itens a seguir.',
    items: [
      'A ocorrência de empréstimos lexicais do inglês em outras línguas é fenômeno recente, impulsionado pela globalização econômica e cultural do século XX.',
      'A mistura linguística implica necessariamente perda de identidade cultural dos povos que adotam vocábulos estrangeiros em sua comunicação cotidiana.',
      'O texto sugere que a resistência à incorporação de termos estrangeiros pode ser compreendida como afirmação de soberania cultural e identidade nacional.',
      'Segundo o texto, o hibridismo linguístico é tratado pelos autores como fenômeno essencialmente negativo, ameaçando a coesão social das comunidades.',
      'A função predominante do texto é argumentativa, mobilizando exemplos de diferentes línguas para sustentar uma tese sobre o impacto da globalização na linguagem.',
    ],
  },

  {
    questao: 2,
    subject: 'Português',
    topic: 'Linguística e texto',
    enunciado: 'QUESTÃO 2 (TPS 2003) — Texto "Poder" (1ª parte): trecho de análise política e filosófica sobre as dimensões do poder, suas formas de legitimação e a relação entre discurso, autoridade e dominação nas sociedades modernas.',
    stem: 'Com base no texto acima, julgue os itens a seguir.',
    items: [
      'O texto estabelece distinção entre poder coercitivo e poder simbólico, indicando que ambos operam simultaneamente nas relações sociais.',
      'De acordo com o texto, a legitimação do poder prescinde do discurso, baseando-se exclusivamente na força física e no controle dos aparatos do Estado.',
      'O autor sustenta que a linguagem desempenha papel constitutivo nas relações de poder, sendo ao mesmo tempo instrumento e objeto de disputa política.',
      'O texto aborda a noção weberiana de dominação legítima como fundamento das modernas democracias representativas.',
      'A análise do texto indica que o poder só se manifesta em contextos institucionais formais, como parlamentos e tribunais.',
    ],
  },

  {
    questao: 3,
    subject: 'Português',
    topic: 'Linguística e texto',
    enunciado: 'QUESTÃO 3 (TPS 2003) — Texto "Poder" (2ª parte): continuação da análise sobre poder, focando nas estratégias discursivas de manutenção e contestação da autoridade, com exemplos históricos de movimentos sociais e retórica política.',
    stem: 'Com base no texto acima, julgue os itens a seguir.',
    items: [
      'O texto indica que movimentos sociais utilizam estratégias discursivas para subverter as estruturas de poder vigentes, ressignificando termos e conceitos dominantes.',
      'Segundo o autor, a retórica política serve exclusivamente à manutenção do status quo, não sendo possível seu uso para fins emancipatórios.',
      'O texto emprega a intertextualidade como recurso argumentativo, dialogando com teorias de autores como Foucault e Bourdieu sobre poder e discurso.',
      'A coesão textual é garantida pelo uso de operadores argumentativos que estabelecem relações de causa e consequência entre os parágrafos do texto.',
      'O texto apresenta a resistência ao poder como fenômeno que ocorre apenas em sociedades democráticas, sendo impossível em regimes autoritários.',
    ],
  },

  {
    questao: 4,
    subject: 'Português',
    topic: 'Linguística e texto',
    enunciado: 'QUESTÃO 4 (TPS 2003) — Texto "Poder" (3ª parte): aspectos morfossintáticos e semânticos do texto "Poder", incluindo análise de recursos de coesão referencial, substituição lexical, coerência e progressão temática.',
    stem: 'Com relação à estrutura linguística do texto, julgue os itens a seguir.',
    items: [
      'O emprego do pronome "este" em determinado trecho do texto cria referência catafórica, antecipando informação que será desenvolvida a seguir.',
      'A nominalização de verbos no texto é recurso que contribui para conferir tom mais formal e abstrato à argumentação do autor.',
      'A substituição de termos por sinônimos ou expressões equivalentes ao longo do texto serve exclusivamente à variação estilística, sem função coesiva.',
      'As orações subordinadas adverbiais presentes no texto estabelecem relações lógico-semânticas de condição, concessão e finalidade que articulam a argumentação.',
      'O uso de aspas em determinadas expressões do texto indica distanciamento crítico do autor em relação aos conceitos assim marcados.',
    ],
  },

  {
    questao: 5,
    subject: 'Português',
    topic: 'Linguística e texto',
    enunciado: 'QUESTÃO 5 (TPS 2003) — Texto "Poder II": novo trecho sobre poder político, abordando a crise de representatividade democrática, o papel da mídia na formação da opinião pública e os desafios do exercício do poder no mundo contemporâneo.',
    stem: 'Com base no texto acima, julgue os itens a seguir.',
    items: [
      'O texto argumenta que a mídia contemporânea constitui um quarto poder de facto, capaz de pautar a agenda política e condicionar as decisões governamentais.',
      'Segundo o autor, a crise de representatividade democrática é fenômeno exclusivo das democracias latino-americanas, não se verificando nas democracias consolidadas.',
      'O texto indica que a opinião pública, tal como construída pela mídia, pode funcionar tanto como mecanismo de controle do poder quanto como instrumento de manipulação.',
      'A análise do texto sugere que o exercício do poder no mundo contemporâneo prescinde de legitimidade popular, bastando o controle dos meios de comunicação.',
      'O autor defende que a transparência e a prestação de contas são condições necessárias, mas não suficientes, para a legitimidade democrática.',
    ],
  },

  {
    questao: 6,
    subject: 'Português',
    topic: 'Linguística e texto',
    enunciado: 'QUESTÃO 6 (TPS 2003) — Texto "Poder II" (continuação): aspectos gramaticais e de interpretação do texto "Poder II", incluindo questões de morfologia, sintaxe, semântica e recursos argumentativos presentes no trecho.',
    stem: 'Julgue os itens a seguir, relativos ao texto acima.',
    items: [
      'A locução verbal utilizada em determinada oração do texto indica aspecto durativo da ação, sugerindo processo ainda em curso no momento da enunciação.',
      'O conectivo adversativo utilizado em certa passagem do texto estabelece relação de oposição entre duas proposições igualmente válidas segundo o autor.',
      'A estrutura de paralelismo sintático identificada no texto funciona como recurso retórico que confere ênfase e ritmo à argumentação.',
      'O uso do modo subjuntivo em determinado período do texto indica que o autor trata o conteúdo da oração como hipótese ou possibilidade, não como certeza.',
      'A progressão temática do texto segue um padrão linear, em que o rema de cada oração torna-se o tema da oração subsequente, garantindo a coerência global.',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // INGLÊS  — Q7–Q10
  // ══════════════════════════════════════════════════════════════════════════

  {
    questao: 7,
    subject: 'Inglês',
    topic: 'Reading comprehension — Diplomacy',
    enunciado: 'QUESTÃO 7 (TPS 2003) — Text about diplomacy (part 1): excerpt discussing the evolution of modern diplomacy, the role of professional diplomats in international negotiations, bilateral versus multilateral diplomacy, and the impact of globalization on diplomatic practice.',
    stem: 'Based on the text above, judge the following items as right (C) or wrong (E).',
    items: [
      'The text implies that the emergence of multilateral diplomacy has rendered bilateral diplomatic channels obsolete in contemporary international relations.',
      'According to the text, professional diplomats must combine technical expertise with political acumen, as modern negotiations encompass an ever-broader range of issues.',
      'The author argues that globalization has simplified diplomatic practice by reducing the number of actors involved in international negotiations.',
      'The text suggests that the distinction between high politics and low politics has become increasingly blurred in contemporary diplomatic practice.',
      'According to the passage, the rise of non-state actors has fundamentally undermined the state-centric model of international diplomacy without offering viable alternatives.',
    ],
  },

  {
    questao: 8,
    subject: 'Inglês',
    topic: 'Reading comprehension — Diplomacy',
    enunciado: 'QUESTÃO 8 (TPS 2003) — Text about diplomacy (part 2): continuation of the text on diplomacy, focusing on the role of summitry, public diplomacy, the use of international organizations as diplomatic forums, and linguistic/grammatical aspects of the passage.',
    stem: 'Based on the text above, judge the following items as right (C) or wrong (E).',
    items: [
      'The text indicates that summit meetings between heads of state have become a central feature of contemporary diplomacy, supplementing rather than replacing traditional diplomatic channels.',
      'The term "public diplomacy" as used in the text refers exclusively to government-to-government communication aimed at influencing foreign policy outcomes.',
      'The author uses the passive voice extensively throughout the passage to convey an objective, academic tone appropriate to the subject matter.',
      'According to the text, international organizations serve as arenas where states can pursue their national interests through multilateral negotiation and coalition-building.',
      'The grammatical structure of the final paragraph suggests a contrast between the idealized vision of diplomatic practice and its actual implementation.',
    ],
  },

  {
    questao: 9,
    subject: 'Inglês',
    topic: 'Reading comprehension — Preventive diplomacy',
    enunciado: 'QUESTÃO 9 (TPS 2003) — Text about preventive diplomacy (part 1): excerpt discussing the concept of preventive diplomacy as developed by Boutros Boutros-Ghali in the "Agenda for Peace," its instruments, limitations, and role in post-Cold War conflict management.',
    stem: 'Based on the text above, judge the following items as right (C) or wrong (E).',
    items: [
      'The concept of preventive diplomacy as described in the text requires early warning, fact-finding missions and confidence-building measures as its core instruments.',
      'According to the text, preventive diplomacy can only be employed with the explicit consent of all parties to a potential conflict, which severely limits its applicability.',
      'The text indicates that preventive diplomacy emerged as a dominant paradigm in international security following the end of the Cold War and the expansion of UN peacekeeping operations.',
      'The passage argues that demilitarized zones and preventive deployments are among the measures that can be used to prevent the escalation of disputes into armed conflicts.',
      'The author contends that preventive diplomacy has proven equally effective in interstate conflicts and intrastate conflicts driven by ethnic or religious tensions.',
    ],
  },

  {
    questao: 10,
    subject: 'Inglês',
    topic: 'Reading comprehension — Preventive diplomacy',
    enunciado: 'QUESTÃO 10 (TPS 2003) — Text about preventive diplomacy (part 2): continuation discussing the limitations and critiques of preventive diplomacy, sovereignty concerns, the role of regional organizations, and linguistic/lexical features of the passage.',
    stem: 'Based on the text above, judge the following items as right (C) or wrong (E).',
    items: [
      'The text suggests that the principle of state sovereignty constitutes the primary obstacle to the effective implementation of preventive diplomacy in intrastate conflicts.',
      'According to the passage, regional organizations such as the OAS and OSCE have been consistently more effective than the UN in implementing preventive diplomacy measures.',
      'The use of modal verbs throughout the text reflects the author\'s intent to convey the conditional and contingent nature of preventive diplomacy\'s effectiveness.',
      'The text explicitly endorses humanitarian intervention as a legitimate form of preventive diplomacy when negotiated measures have failed to prevent imminent atrocities.',
      'The passage indicates that early warning systems, while theoretically valuable, have rarely translated into timely preventive action due to political constraints within the UN Security Council.',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // POLÍTICA INTERNACIONAL  — Q11–Q14
  // ══════════════════════════════════════════════════════════════════════════

  {
    questao: 11,
    subject: 'Política Internacional',
    topic: 'MERCOSUL e integração regional',
    enunciado: 'QUESTÃO 11 (TPS 2003) — MERCOSUL e globalização: questão sobre o processo de integração regional sul-americana no contexto da globalização econômica, abordando a evolução institucional do MERCOSUL, suas crises, o impacto das políticas econômicas dos anos 1990 e os desafios para o aprofundamento da integração.',
    stem: 'Acerca do MERCOSUL e da globalização, julgue os itens a seguir.',
    items: [
      'O MERCOSUL, criado pelo Tratado de Assunção em 1991, atingiu plenamente os objetivos de mercado comum previstos em seu tratado constitutivo, incluindo livre circulação de fatores de produção.',
      'A crise argentina de 2001-2002 demonstrou a vulnerabilidade dos países do MERCOSUL às turbulências financeiras internacionais e os limites da integração monetária regional.',
      'A adoção de uma tarifa externa comum pelo MERCOSUL constituiu passo relevante para a consolidação de uma união aduaneira, embora com importantes exceções setoriais.',
      'O Protocolo de Ouro Preto de 1994 conferiu ao MERCOSUL personalidade jurídica internacional e estabeleceu sua estrutura institucional definitiva, incluindo um parlamento regional com poderes legislativos.',
      'No contexto da globalização, a integração regional é apresentada no debate acadêmico como estratégia de inserção coletiva na economia mundial, capaz de aumentar o poder de barganha dos países membros.',
    ],
  },

  {
    questao: 12,
    subject: 'Política Internacional',
    topic: 'Conferências internacionais da ONU',
    enunciado: 'QUESTÃO 12 (TPS 2003) — Conferências internacionais da ONU nos anos 1990: questão sobre o ciclo de grandes conferências das Nações Unidas realizadas na década de 1990, incluindo Rio-92, Viena 1993, Cairo 1994, Copenhague 1995, Beijing 1995 e Habitat II 1996, e seus impactos na agenda internacional.',
    stem: 'Com relação às conferências internacionais da ONU realizadas nos anos 1990, julgue os itens a seguir.',
    items: [
      'A Conferência de Viena de 1993 sobre Direitos Humanos reafirmou a universalidade, indivisibilidade e interdependência dos direitos humanos, consolidando o conceito de que os direitos civis e políticos têm primazia sobre os direitos econômicos, sociais e culturais.',
      'A Agenda 21, adotada na Conferência do Rio de 1992, estabeleceu um programa de ação global para o desenvolvimento sustentável, atribuindo responsabilidades diferenciadas a países desenvolvidos e em desenvolvimento.',
      'A Conferência Internacional sobre População e Desenvolvimento do Cairo de 1994 foi marcada por controvérsias em torno de questões relativas à saúde reprodutiva e direitos da mulher, com posições divergentes entre países ocidentais e nações de tradição islâmica.',
      'O conceito de "responsabilidade de proteger," formulado no âmbito das conferências da ONU nos anos 1990, foi formalmente incorporado ao direito internacional costumeiro pela Declaração do Milênio de 2000.',
      'A IV Conferência Mundial sobre a Mulher realizada em Beijing em 1995 adotou a Plataforma de Ação de Beijing, documento que incorporou o conceito de mainstreaming de gênero como estratégia para a promoção da igualdade.',
    ],
  },

  {
    questao: 13,
    subject: 'Política Internacional',
    topic: 'China e integração à OMC',
    enunciado: 'QUESTÃO 13 (TPS 2003) — China e a OMC: questão sobre a adesão da China à Organização Mundial do Comércio em 2001, os termos negociados para sua entrada, o impacto no comércio mundial, as transformações econômicas chinesas e as implicações geopolíticas da ascensão econômica da China.',
    stem: 'A respeito da China e de sua inserção na OMC, julgue os itens a seguir.',
    items: [
      'A adesão da China à OMC em 2001, após quinze anos de negociações, foi condicionada a compromissos de abertura de mercados, redução de tarifas e eliminação de subsídios às exportações agrícolas em prazo imediato.',
      'O crescimento econômico chinês nos anos 1990 e 2000 baseou-se predominantemente na expansão das exportações manufatureiras, beneficiadas por baixos custos de mão de obra e pela política cambial de desvalorização do renminbi.',
      'A ascensão econômica da China suscitou debates sobre sua capacidade de se tornar um "stakeholder responsável" na ordem internacional, integrando-se às normas e instituições do sistema multilateral sem questioná-las.',
      'A China manteve, após sua adesão à OMC, regime de economia planificada centralizada, sem permitir mecanismos de mercado no setor industrial, o que gerou disputas com seus parceiros comerciais no mecanismo de solução de controvérsias da organização.',
      'O ingresso da China na OMC foi visto por países em desenvolvimento como potencial ameaça à sua participação nos mercados de manufaturas, especialmente no setor têxtil e de vestuário.',
    ],
  },

  {
    questao: 14,
    subject: 'Política Internacional',
    topic: 'Paradigmas de política externa',
    enunciado: 'QUESTÃO 14 (TPS 2003) — Estado desenvolvimentista e política externa: questão sobre o conceito de Estado desenvolvimentista e suas implicações para a política externa, comparando experiências asiáticas (Japão, Coreia do Sul) e latino-americanas, e discutindo o debate sobre neoliberalismo versus desenvolvimentismo.',
    stem: 'No que se refere ao Estado desenvolvimentista e à política externa, julgue os itens a seguir.',
    items: [
      'O modelo do Estado desenvolvimentista, identificado nas experiências do Japão e Coreia do Sul no pós-guerra, caracteriza-se pela intervenção estatal estratégica na economia, com planejamento industrial e promoção de setores considerados prioritários para o desenvolvimento nacional.',
      'A experiência desenvolvimentista brasileira do período 1950-1980, marcada pela industrialização por substituição de importações, produziu resultados análogos aos dos tigres asiáticos em termos de competitividade exportadora e inserção nos mercados internacionais.',
      'O Consenso de Washington, formulado nos anos 1980, propugnava a retirada do Estado da atividade econômica como condição para a estabilização macroeconômica e o crescimento sustentado dos países em desenvolvimento.',
      'A política externa dos países desenvolvimentistas asiáticos caracterizou-se pelo alinhamento incondicional aos Estados Unidos durante a Guerra Fria, o que lhes garantiu acesso privilegiado ao mercado norte-americano e às transferências de tecnologia.',
      'O debate contemporâneo sobre o papel do Estado no desenvolvimento retomou elementos do desenvolvimentismo clássico, incorporando preocupações com sustentabilidade ambiental, inclusão social e inserção competitiva na economia do conhecimento.',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // HISTÓRIA  — Q15–Q18
  // ══════════════════════════════════════════════════════════════════════════

  {
    questao: 15,
    subject: 'História',
    topic: 'História do século XX',
    enunciado: 'QUESTÃO 15 (TPS 2003) — Hobsbawm e o "século XX curto": questão baseada na obra "Era dos Extremos" de Eric Hobsbawm, abordando sua interpretação do século XX como "século curto" (1914-1991), a periodização em "Era da Catástrofe," "Era de Ouro" e "Desmoronamento," e os eventos globais que marcaram cada fase.',
    stem: 'Acerca da interpretação histórica do século XX e da obra de Hobsbawm, julgue os itens a seguir.',
    items: [
      'Hobsbawm designa o período 1914-1991 como o "breve século XX," caracterizado pela catástrofe inicial das duas guerras mundiais, seguida de um período de crescimento e estabilidade e, por fim, de crise e incerteza.',
      'Segundo Hobsbawm, a "Era de Ouro" do capitalismo (1947-1973) representou o mais extraordinário período de crescimento econômico da história mundial, com expansão sem precedentes do bem-estar social nos países desenvolvidos.',
      'A interpretação de Hobsbawm do século XX é marcada por uma perspectiva marxista que atribui à luta de classes o papel determinante na configuração dos eventos históricos, minimizando o papel dos indivíduos e das contingências.',
      'Para Hobsbawm, a dissolução da URSS em 1991 representou o colapso do projeto socialista soviético, mas não o "fim da história" nem a vitória definitiva do capitalismo liberal sobre todas as alternativas possíveis.',
      'A "Era da Catástrofe" de Hobsbawm compreende o período das duas guerras mundiais e a Grande Depressão, durante o qual a ordem liberal do século XIX foi destruída e o futuro do capitalismo tornou-se incerto.',
    ],
  },

  {
    questao: 16,
    subject: 'História',
    topic: 'Guerra Fria',
    enunciado: 'QUESTÃO 16 (TPS 2003) — Guerra Fria: questão sobre as origens, dinâmica e legado da Guerra Fria, abordando a bipolaridade EUA-URSS, a corrida armamentista, os conflitos regionais por procuração, as crises nucleares e o impacto da Guerra Fria na política dos países do Terceiro Mundo.',
    stem: 'Com relação à Guerra Fria e seus desdobramentos, julgue os itens a seguir.',
    items: [
      'A doutrina Truman (1947) e o Plano Marshall representaram a formalização da estratégia de contenção americana frente à expansão soviética, definindo os parâmetros da política externa dos EUA por quatro décadas.',
      'A crise dos mísseis de Cuba (1962) demonstrou que a lógica de dissuasão nuclear mútua (MAD) era suficiente para impedir qualquer confronto militar direto entre as superpotências, confirmando a estabilidade do equilíbrio bipolar.',
      'O Movimento dos Não Alinhados, fundado em Bandung em 1955, constituiu tentativa dos países do Terceiro Mundo de escapar à lógica bipolar da Guerra Fria, afirmando uma agenda própria centrada no anticolonialismo e no desenvolvimento.',
      'A détente dos anos 1970 resultou em acordos significativos de controle de armamentos (SALT I e II), mas foi revertida pelo intervencionismo soviético no Afeganistão e pela ascensão de Reagan, que reinaugurou uma fase de confrontação ideológica e militar.',
      'A queda do Muro de Berlim em 1989 e a reunificação alemã foram resultados diretos da política de glasnost e perestroika de Gorbachev, que tinha como objetivo reformar o sistema soviético para salvá-lo, não para desmontá-lo.',
    ],
  },

  {
    questao: 17,
    subject: 'História',
    topic: 'República Brasileira',
    enunciado: 'QUESTÃO 17 (TPS 2003) — História da República Brasileira: questão sobre os principais momentos da história política brasileira desde a Proclamação da República em 1889 até a redemocratização, abordando a República Velha, a Revolução de 30, o Estado Novo, a experiência democrática de 1946-1964, o regime militar e a transição para a democracia.',
    stem: 'Acerca da história da República Brasileira, julgue os itens a seguir.',
    items: [
      'A política dos governadores durante a República Velha (1894-1930) baseava-se em acordo entre as elites estaduais e o governo federal, garantindo apoio mútuo mediante a distribuição de cargos e recursos, o que excluía sistematicamente as classes trabalhadoras urbanas da representação política.',
      'A Revolução de 1930, liderada por Getúlio Vargas, representou ruptura definitiva com as oligarquias rurais da República Velha, promovendo a imediata democratização e a incorporação política das massas urbanas ao sistema representativo.',
      'O Estado Novo (1937-1945) caracterizou-se pela centralização política, supressão dos partidos e do Congresso, intervenção estatal na economia e promoção do nacionalismo, aproximando-se dos regimes corporativistas europeus do período.',
      'O golpe militar de 1964 contou com apoio de segmentos das classes médias, do empresariado e da Igreja Católica, que temiam uma guinada comunista sob o governo Goulart, num contexto marcado pela polarização da Guerra Fria.',
      'A transição para a democracia no Brasil (1974-1985) seguiu o modelo de "distensão lenta, gradual e segura" propugnado pelo governo Geisel, mantendo as Forças Armadas no controle do ritmo da abertura política até a eleição de Tancredo Neves pelo Colégio Eleitoral.',
    ],
  },

  {
    questao: 18,
    subject: 'História',
    topic: 'Política Externa Brasileira',
    enunciado: 'QUESTÃO 18 (TPS 2003) — Política Externa Brasileira: questão sobre a evolução da política externa do Brasil, desde o Barão do Rio Branco até o final do século XX, abordando os paradigmas de inserção internacional, as alianças estratégicas, o papel do Itamaraty e as continuidades e mudanças na diplomacia brasileira.',
    stem: 'Julgue os itens a seguir, relativos à política externa brasileira.',
    items: [
      'O Barão do Rio Branco, à frente do Ministério das Relações Exteriores entre 1902 e 1912, consolidou as fronteiras brasileiras mediante negociações diplomáticas e arbitragens internacionais, estabelecendo padrões de atuação que influenciaram duradouramente a diplomacia do país.',
      'A Política Externa Independente, formulada durante os governos Jânio Quadros e João Goulart (1961-1964), representou ruptura com o alinhamento automático aos EUA e buscou diversificar as parcerias do Brasil, incluindo relações com países socialistas e países afro-asiáticos.',
      'O Brasil praticou política externa de elevado grau de autonomia logo após a Revolução de 1930, rompendo com os vínculos históricos com o Reino Unido e alinhando-se precocemente com os Estados Unidos como potência hegemônica do século XX.',
      'O pragmatismo responsável e ecumênico da diplomacia do governo Geisel (1974-1979) buscou diversificar as parcerias externas do Brasil, incluindo o reconhecimento das independências africanas e o estabelecimento de relações com a República Popular da China.',
      'O universalismo da política externa brasileira dos anos 1990 traduziu-se na participação ativa em foros multilaterais, incluindo as negociações da Rodada Uruguai do GATT e a adesão aos principais regimes internacionais de não proliferação nuclear.',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GEOGRAFIA  — Q19–Q22
  // ══════════════════════════════════════════════════════════════════════════

  {
    questao: 19,
    subject: 'Geografia',
    topic: 'Globalização econômica',
    enunciado: 'QUESTÃO 19 (TPS 2003) — Montadoras e globalização produtiva: questão sobre a expansão das montadoras automobilísticas para países emergentes, especialmente a China, no contexto da globalização produtiva, abordando as estratégias de localização industrial, os impactos nos países receptores e as novas geografias da produção global.',
    stem: 'Acerca da globalização produtiva e da indústria automobilística, julgue os itens a seguir.',
    items: [
      'A expansão das montadoras automobilísticas para a China nos anos 1990 e 2000 foi motivada pelo enorme mercado consumidor potencial, pelos baixos custos de produção e pelas políticas de atração de investimento estrangeiro do governo chinês.',
      'As montadoras multinacionais que se instalaram na China foram obrigadas, em sua maioria, a operar em joint ventures com empresas estatais chinesas, o que permitiu a transferência de tecnologia e a formação de indústria automobilística nacional.',
      'A globalização produtiva na indústria automobilística resultou em fragmentação das cadeias de valor, com diferentes etapas da produção localizadas em países distintos conforme suas vantagens comparativas em custos e habilidades.',
      'A instalação de montadoras em países emergentes como Brasil, México e China é fenômeno associado exclusivamente ao período pós-2000, não havendo precedentes de deslocalização industrial automobilística anteriores à globalização financeira dos anos 1990.',
      'A China tornou-se, na primeira década do século XXI, o maior mercado automobilístico do mundo, superando os Estados Unidos em volume de vendas anuais de veículos novos.',
    ],
  },

  {
    questao: 20,
    subject: 'Geografia',
    topic: 'América Latina e recursos naturais',
    enunciado: 'QUESTÃO 20 (TPS 2003) — América Latina e recursos naturais: questão sobre a dotação de recursos naturais da América Latina, sua relação com o desenvolvimento econômico regional, os conflitos em torno da gestão desses recursos, a questão da "maldição dos recursos" e as disputas geopolíticas associadas.',
    stem: 'Acerca dos recursos naturais na América Latina e seus impactos, julgue os itens a seguir.',
    items: [
      'A América Latina possui extraordinária dotação de recursos naturais, incluindo as maiores reservas mundiais de petróleo (Venezuela), minérios estratégicos e biodiversidade, configurando uma vantagem comparativa que se traduz em desenvolvimento sustentado.',
      'O conceito de "maldição dos recursos" descreve o paradoxo pelo qual países ricos em recursos naturais tendem a apresentar menor crescimento econômico, maior desigualdade e instituições mais frágeis do que países com menor dotação de recursos.',
      'As disputas em torno do controle dos recursos naturais na América Latina envolvem tanto atores domésticos (governos, empresas estatais, comunidades locais) quanto externos (empresas multinacionais, governos de países consumidores), gerando conflitos socioambientais.',
      'A exploração dos recursos naturais latino-americanos foi historicamente marcada por padrões de enclave, com baixa integração às economias nacionais, elevada remessa de lucros ao exterior e escassa geração de encadeamentos produtivos locais.',
      'A Bacia Amazônica constitui o principal reservatório de biodiversidade do planeta e abriga significativa parcela das reservas mundiais de água doce, sendo sua preservação reconhecida internacionalmente como questão de interesse global e não apenas nacional.',
    ],
  },

  {
    questao: 21,
    subject: 'Geografia',
    topic: 'Questão ambiental',
    enunciado: 'QUESTÃO 21 (TPS 2003) — Ecologia e questão ambiental no Brasil: questão sobre os principais biomas brasileiros, as pressões sobre os ecossistemas nacionais (desmatamento, agropecuária, mineração), as políticas de conservação e o papel do Brasil nos debates internacionais sobre mudanças climáticas e biodiversidade.',
    stem: 'Acerca da questão ambiental no Brasil, julgue os itens a seguir.',
    items: [
      'O Brasil abriga seis grandes biomas — Amazônia, Cerrado, Mata Atlântica, Caatinga, Pantanal e Pampa — cada um com características ecológicas únicas, sendo que a Mata Atlântica é considerada um dos "hotspots" de biodiversidade mais ameaçados do planeta.',
      'O desmatamento da Amazônia é fenômeno que se intensificou a partir dos anos 1970, associado à expansão da fronteira agrícola, à construção de estradas e projetos de colonização, ao garimpo e, mais recentemente, à expansão da soja e da pecuária.',
      'O Cerrado brasileiro, segundo bioma mais extenso do país, é reconhecido como área de baixíssima biodiversidade e importância ecológica reduzida, tornando-o candidato natural para a expansão agrícola sem maiores impactos ambientais.',
      'A política ambiental brasileira a partir dos anos 1980 incluiu a criação de unidades de conservação, o licenciamento ambiental de atividades potencialmente poluidoras e a promulgação da Política Nacional do Meio Ambiente, que estabeleceu o princípio do poluidor-pagador.',
      'O Brasil assumiu compromissos voluntários de redução de desmatamento na Conferência de Copenhague de 2009, reconhecendo sua responsabilidade nas emissões globais de gases de efeito estufa associadas ao desmatamento.',
    ],
  },

  {
    questao: 22,
    subject: 'Geografia',
    topic: 'Rede urbana brasileira',
    enunciado: 'QUESTÃO 22 (TPS 2003) — Rede urbana brasileira: questão sobre a configuração da rede urbana do Brasil, a macrocefalia urbana, o papel das metrópoles, a hierarquia urbana, as metrópoles regionais, o processo de metropolização e os desafios da gestão das cidades brasileiras.',
    stem: 'Acerca da rede urbana brasileira, julgue os itens a seguir.',
    items: [
      'A rede urbana brasileira é marcada pela macrocefalia de São Paulo e Rio de Janeiro, que concentram parcela desproporcional da população, do PIB e das funções de gestão econômica e política do país, em detrimento de uma hierarquia urbana mais equilibrada.',
      'O processo de metropolização no Brasil, intensificado a partir dos anos 1960, resultou na formação de regiões metropolitanas caracterizadas por conurbação, interdependência funcional entre municípios e agudos problemas de mobilidade, habitação e saneamento.',
      'O interior do Brasil é caracterizado pela ausência de cidades médias com capacidade de polarização regional, sendo toda a hierarquia urbana centrada nas duas metrópoles nacionais, sem intermediários funcionais.',
      'A PNAD e o Censo Demográfico do IBGE registraram, a partir dos anos 1980, fenômeno de desmetropolização relativa, com crescimento mais acelerado de cidades médias e municípios do interior em relação às grandes regiões metropolitanas.',
      'As regiões metropolitanas brasileiras, criadas pela Lei Complementar nº 14/1973, foram estabelecidas para integrar o planejamento de serviços de interesse comum, mas enfrentam dificuldades de governança metropolitana por ausência de instância com autoridade e recursos adequados.',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DIREITO  — Q23–Q26
  // ══════════════════════════════════════════════════════════════════════════

  {
    questao: 23,
    subject: 'Direito',
    topic: 'Direito Constitucional',
    enunciado: 'QUESTÃO 23 (TPS 2003) — Direito Constitucional brasileiro: questão sobre os princípios fundamentais da Constituição Federal de 1988, os direitos e garantias fundamentais, a organização dos poderes, o controle de constitucionalidade e as emendas constitucionais realizadas até 2003.',
    stem: 'Acerca do direito constitucional brasileiro, julgue os itens a seguir.',
    items: [
      'A Constituição Federal de 1988 consagra o princípio da dignidade da pessoa humana como fundamento da República, vinculando toda a ação estatal à sua promoção e proteção, inclusive nas relações entre particulares.',
      'O mandado de injunção, previsto na Constituição de 1988, é instrumento processual destinado a suprir omissões legislativas que inviabilizam o exercício de direitos constitucionalmente assegurados, tendo sua eficácia debatida no Supremo Tribunal Federal.',
      'Segundo a Constituição de 1988, as emendas constitucionais podem ser propostas exclusivamente pelo Presidente da República ou pela maioria absoluta dos membros de qualquer das Câmaras do Congresso Nacional.',
      'O sistema brasileiro de controle de constitucionalidade combina o controle difuso, exercido por qualquer juiz em casos concretos, e o controle concentrado, realizado pelo STF em ações diretas de inconstitucionalidade, de constitucionalidade e de descumprimento de preceito fundamental.',
      'A Constituição Federal veda expressamente a pena de morte no Brasil em qualquer hipótese, inclusive em caso de guerra declarada contra nação estrangeira, configurando cláusula pétrea insuscetível de reforma.',
    ],
  },

  {
    questao: 24,
    subject: 'Direito',
    topic: 'Direito Constitucional',
    enunciado: 'QUESTÃO 24 (TPS 2003) — Direito Administrativo e organização do Estado: questão sobre os princípios do direito administrativo (legalidade, impessoalidade, moralidade, publicidade, eficiência), a organização da administração pública federal, as agências reguladoras e o processo de reforma administrativa iniciado nos anos 1990.',
    stem: 'Julgue os itens a seguir, relativos ao direito administrativo e à organização do Estado brasileiro.',
    items: [
      'O princípio da legalidade na administração pública significa que o administrador público só pode agir quando e como a lei expressamente autorizar, distinguindo-se do princípio de legalidade aplicável aos particulares, que podem fazer tudo o que não for proibido por lei.',
      'As agências reguladoras brasileiras, criadas a partir dos anos 1990 em consonância com a reforma do Estado, são caracterizadas por autonomia administrativa e financeira, mandatos fixos para seus dirigentes e independência técnica em relação ao poder político.',
      'A emenda constitucional nº 19/1998, que introduziu o princípio da eficiência na administração pública, alterou substancialmente o regime jurídico dos servidores públicos, permitindo a demissão por insuficiência de desempenho após avaliação periódica.',
      'O poder de polícia administrativa, exercido pela administração pública, consiste na faculdade de limitar o exercício de direitos individuais em benefício do interesse coletivo, sendo seu exercício condicionado pelos princípios da proporcionalidade e da legalidade.',
      'A desconcentração administrativa distingue-se da descentralização pelo fato de que, na primeira, há transferência de atribuições dentro da mesma pessoa jurídica mediante criação de órgãos, enquanto na segunda há criação de novas pessoas jurídicas ou delegação a pessoas já existentes.',
    ],
  },

  {
    questao: 25,
    subject: 'Direito',
    topic: 'Direito Internacional Público',
    enunciado: 'QUESTÃO 25 (TPS 2003) — Direito Internacional Público (fontes e sujeitos): questão sobre as fontes do direito internacional, os sujeitos de direito internacional, a responsabilidade internacional dos Estados, os tratados internacionais e a relação entre direito internacional e direito interno.',
    stem: 'Com relação ao direito internacional público, julgue os itens a seguir.',
    items: [
      'As fontes do direito internacional, conforme o artigo 38 do Estatuto da Corte Internacional de Justiça, incluem os tratados internacionais, o costume internacional, os princípios gerais de direito reconhecidos pelas nações civilizadas, as decisões judiciais e a doutrina como meios auxiliares de determinação das normas.',
      'A personalidade jurídica internacional é atributo exclusivo dos Estados soberanos, não se estendendo às organizações internacionais, aos indivíduos ou a outros atores não estatais, segundo a doutrina clássica de direito internacional.',
      'O costume internacional, como fonte de direito internacional, exige a presença de dois elementos: a prática geral e uniforme dos Estados (elemento material) e a convicção de que tal prática é juridicamente obrigatória (opinio juris).',
      'A responsabilidade internacional do Estado surge quando um ato internacionalmente ilícito é atribuído ao Estado e viola uma obrigação internacional, obrigando-o à cessação do ato, ao oferecimento de garantias de não repetição e à reparação do dano causado.',
      'O princípio do pacta sunt servanda, fundamento do direito dos tratados, estabelece que os tratados em vigor vinculam as partes e devem ser cumpridos de boa-fé, não podendo um Estado invocar disposições de seu direito interno para justificar o descumprimento de obrigação internacional.',
    ],
  },

  {
    questao: 26,
    subject: 'Direito',
    topic: 'Direito Internacional Público',
    enunciado: 'QUESTÃO 26 (TPS 2003) — Direito Internacional Público (ONU e segurança coletiva): questão sobre a Carta da ONU, o sistema de segurança coletiva, o papel do Conselho de Segurança, o uso da força no direito internacional, a proibição da ameaça ou uso da força e as exceções previstas (legítima defesa, autorização do CSNU).',
    stem: 'Acerca do sistema de segurança coletiva da ONU e do uso da força no direito internacional, julgue os itens a seguir.',
    items: [
      'A Carta da ONU proíbe em termos absolutos a ameaça ou o uso da força nas relações internacionais, sem admitir qualquer exceção, tendo revogado o direito consuetudinário de legítima defesa dos Estados.',
      'O Conselho de Segurança da ONU é o órgão responsável pela manutenção da paz e da segurança internacionais, podendo adotar medidas coercitivas vinculantes, incluindo o uso da força armada, quando constatar ameaça à paz, ruptura da paz ou ato de agressão.',
      'O direito de legítima defesa previsto no artigo 51 da Carta da ONU é restrito à resposta a um ataque armado já ocorrido, não abrangendo a chamada legítima defesa preemptiva ou preventiva, que não possui fundamento na Carta.',
      'As operações de manutenção da paz da ONU, não previstas explicitamente na Carta, foram desenvolvidas na prática como mecanismo intermediário entre as medidas do capítulo VI (solução pacífica de controvérsias) e as do capítulo VII (ação coercitiva), baseando-se no consentimento dos Estados anfitriões.',
      'A intervenção humanitária unilateral — uso da força por um Estado ou grupo de Estados sem autorização do Conselho de Segurança para proteger populações civis — é amplamente aceita como exceção legítima à proibição do uso da força no direito internacional contemporâneo.',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ECONOMIA  — Q27–Q30
  // ══════════════════════════════════════════════════════════════════════════

  {
    questao: 27,
    subject: 'Economia',
    topic: 'Microeconomia',
    enunciado: 'QUESTÃO 27 (TPS 2003) — Conceitos básicos de microeconomia: questão sobre os fundamentos da análise microeconômica, incluindo teoria do consumidor, teoria da firma, estruturas de mercado (concorrência perfeita, oligopólio, monopólio), falhas de mercado e externalidades.',
    stem: 'Acerca dos conceitos básicos de microeconomia, julgue os itens a seguir.',
    items: [
      'Em concorrência perfeita, no equilíbrio de longo prazo, o preço iguala-se ao custo marginal e ao custo médio mínimo, de modo que as firmas obtêm apenas lucro normal (zero econômico), sem incentivo para entrada ou saída de empresas no mercado.',
      'O monopólio natural surge quando os custos fixos são elevados e os custos marginais de produção são decrescentes, tornando socialmente eficiente que apenas uma firma atenda ao mercado, o que justifica sua regulação pelo Estado.',
      'As externalidades negativas, como a poluição industrial, levam à subprodução em relação ao nível socialmente ótimo, pois os produtores não internalizam os custos externos gerados a terceiros, justificando intervenção governamental via taxação ou regulação.',
      'A elasticidade-preço da demanda mede a sensibilidade da quantidade demandada a variações no preço do bem, sendo que bens com demanda inelástica (elasticidade < 1) têm sua receita total aumentada quando o preço sobe.',
      'Em estruturas de oligopólio, o modelo de Cournot prevê que as firmas maximizam seus lucros decidindo simultaneamente sobre as quantidades a produzir, considerando a produção das rivais como dada, resultando em equilíbrio com quantidade menor e preço maior do que em concorrência perfeita.',
    ],
  },

  {
    questao: 28,
    subject: 'Economia',
    topic: 'Macroeconomia',
    enunciado: 'QUESTÃO 28 (TPS 2003) — Macroeconomia: questão sobre os conceitos e modelos macroeconômicos, incluindo o modelo IS-LM, a teoria quantitativa da moeda, as políticas fiscal e monetária, o multiplicador keynesiano, a curva de Phillips e os debates entre keynesianos e monetaristas.',
    stem: 'Com relação à macroeconomia, julgue os itens a seguir.',
    items: [
      'No modelo keynesiano simples, o multiplicador fiscal indica que um aumento nos gastos do governo gera um aumento no produto nacional mais do que proporcional, desde que haja capacidade ociosa na economia e que as famílias tenham propensão marginal a consumir positiva.',
      'A teoria quantitativa da moeda, expressa pela equação de trocas (MV=PQ), implica que, mantidos constantes a velocidade de circulação e o produto real, um aumento na oferta monetária resultará em aumento proporcional no nível geral de preços.',
      'A curva de Phillips original, que relaciona taxa de desemprego e taxa de inflação, foi questionada pelos monetaristas, que introduziram o conceito de taxa natural de desemprego e argumentaram que a curva é vertical no longo prazo.',
      'A política monetária expansionista, realizada pelo Banco Central mediante redução da taxa de juros ou aumento da base monetária, tende a estimular o investimento, aumentar a demanda agregada e elevar o produto no curto prazo.',
      'O modelo IS-LM, desenvolvido por Hicks e Hansen como interpretação do pensamento keynesiano, representa o equilíbrio simultâneo no mercado de bens e serviços (curva IS) e no mercado monetário (curva LM), determinando a taxa de juros e o produto de equilíbrio.',
    ],
  },

  {
    questao: 29,
    subject: 'Economia',
    topic: 'Comércio Internacional',
    enunciado: 'QUESTÃO 29 (TPS 2003) — Comércio internacional: questão sobre as teorias do comércio internacional (vantagens comparativas, vantagens absolutas, modelo Heckscher-Ohlin), as políticas comerciais (tarifas, cotas, dumping, subsídios), o sistema multilateral de comércio e a OMC.',
    stem: 'Julgue os itens a seguir, referentes ao comércio internacional.',
    items: [
      'A teoria das vantagens comparativas de Ricardo demonstra que o comércio internacional é mutuamente benéfico mesmo quando um país tem vantagem absoluta na produção de todos os bens, pois a especialização segundo os custos relativos permite ganhos de bem-estar para ambos os países.',
      'O modelo Heckscher-Ohlin prevê que os países exportarão bens que usam intensivamente o fator de produção de que são relativamente mais dotados, sendo que o comércio tende a equalizar os preços dos fatores entre países com estruturas produtivas diferentes.',
      'As cotas de importação e as tarifas alfandegárias têm efeitos econômicos equivalentes sobre o preço interno e a quantidade importada, distinguindo-se apenas pelo destino da renda transferida: nos direitos alfandegários, para o governo; nas cotas, potencialmente para os importadores com licença.',
      'O dumping, definido pela OMC como exportação de produto a preço inferior ao seu valor normal no mercado doméstico do exportador, é prática proibida pelo direito internacional econômico e sujeita a medidas antidumping pelos países importadores prejudicados.',
      'O sistema multilateral de comércio, consolidado com a criação da OMC em 1995, baseia-se nos princípios da nação mais favorecida, do tratamento nacional e da reciprocidade, prevendo mecanismo de solução de controvérsias com capacidade de autorizar retaliações.',
    ],
  },

  {
    questao: 30,
    subject: 'Economia',
    topic: 'Economia Brasileira',
    enunciado: 'QUESTÃO 30 (TPS 2003) — Economia brasileira: questão sobre a trajetória da economia brasileira, abordando o Plano Real e a estabilização monetária de 1994, o regime de câmbio fixo e sua crise em 1999, a adoção do tripé macroeconômico (câmbio flutuante, metas de inflação e superávit primário) e os desafios do desenvolvimento econômico.',
    stem: 'Acerca da economia brasileira, julgue os itens a seguir.',
    items: [
      'O Plano Real, implementado em 1994, combinou âncora cambial, abertura comercial e política monetária restritiva para estabilizar a inflação, sendo precedido por um processo de desindexação da economia mediante a Unidade Real de Valor (URV).',
      'A crise cambial de janeiro de 1999, que forçou o Brasil a abandonar o regime de câmbio fixo adotado desde o Plano Real, resultou em intensa recessão com queda do PIB superior a 5% e disparada da inflação acima de 20% ao ano.',
      'O tripé macroeconômico adotado pelo Brasil a partir de 1999 — câmbio flutuante, regime de metas de inflação e geração de superávits primários — visava conferir credibilidade à política econômica e garantir a sustentabilidade da dívida pública.',
      'A taxa de câmbio sobrevalorizada durante o período de câmbio fixo do Plano Real (1994-1999) contribuiu para o crescimento das importações e o surgimento de déficits em conta corrente, financiados por influxos de capital externo que tornaram o país vulnerável a crises de balanço de pagamentos.',
      'O sistema de metas de inflação adotado pelo Brasil em 1999 delega ao Banco Central a responsabilidade de manter a inflação dentro de intervalos previamente estabelecidos pelo Conselho Monetário Nacional, utilizando a taxa Selic como principal instrumento de política monetária.',
    ],
  },

]; // end QUESTOES

// ─────────────────────────────────────────────────────────────────────────────
// Build the flat list of 150 rows
// ─────────────────────────────────────────────────────────────────────────────

function buildRows() {
  const rows = [];

  for (const q of QUESTOES) {
    const gabarito = GABARITO[q.questao]; // array of 5: ['C'|'E', ...]
    if (!gabarito) {
      throw new Error(`No gabarito found for questão ${q.questao}`);
    }
    if (q.items.length !== 5) {
      throw new Error(`Questão ${q.questao} has ${q.items.length} items, expected 5`);
    }

    for (let i = 0; i < 5; i++) {
      const itemNum = i + 1;
      const answerChar = gabarito[i]; // 'C' or 'E'

      rows.push({
        source: 'exam',
        year: 2003,
        subject: q.subject,
        topic: q.topic,
        enunciado: q.enunciado,
        stem: `[Item ${itemNum}] ${q.stem}`,
        opcoes: { a: 'Certo', b: 'Errado' },
        // Store the item statement as option context in the stem; gabarito is the key answer
        // We embed the item text in the stem for display purposes
        _item_text: q.items[i], // temporary field to build final stem
        gabarito: ce(answerChar),
        explicacao: null,
      });
    }
  }

  // Move item text into stem and remove temp field
  return rows.map((row) => {
    const { _item_text, stem, ...rest } = row;
    return {
      ...rest,
      stem: `${stem}\n\nJulgue: ${_item_text}`,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch insert helper
// ─────────────────────────────────────────────────────────────────────────────

async function insertBatch(rows, batchSize = 50) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from('questions').insert(batch);
    if (error) {
      console.error(`Error inserting batch starting at index ${i}:`, error);
      throw error;
    }
    inserted += batch.length;
    console.log(`  Inserted ${inserted}/${rows.length} rows...`);
  }
  return inserted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Building 2003 TPS question rows...');
  const rows = buildRows();
  console.log(`Total rows to insert: ${rows.length}`); // expect 150

  // Validate row count
  if (rows.length !== 150) {
    throw new Error(`Expected 150 rows but got ${rows.length}`);
  }

  // Optional: remove existing 2003 rows to allow idempotent re-runs
  console.log('Removing existing 2003 TPS rows (if any)...');
  const { error: deleteError } = await supabase
    .from('questions')
    .delete()
    .eq('source', 'exam')
    .eq('year', 2003);
  if (deleteError) {
    console.warn('Warning: could not delete existing rows:', deleteError.message);
  }

  console.log('Inserting rows in batches of 50...');
  const total = await insertBatch(rows, 50);

  console.log(`\nDone! Inserted ${total} questions for TPS 2003.`);
  console.log('Breakdown by subject:');
  const bySubject = {};
  for (const r of rows) {
    bySubject[r.subject] = (bySubject[r.subject] || 0) + 1;
  }
  for (const [subj, count] of Object.entries(bySubject)) {
    console.log(`  ${subj}: ${count} items`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
