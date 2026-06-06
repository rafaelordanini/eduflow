const { getSupabase } = require('../../lib/supabase');
const { cors, requireAuth } = require('../../lib/middleware');

// ──────────────────────────────────────────────────────────
//  DADOS DO CACD extraídos do Google Drive (IRBr_Planner)
// ──────────────────────────────────────────────────────────
const CACD_DATA = {
  totalTopicos: 473,
  focoAtual: ['História do Brasil', 'História Mundial', 'Português'],
  materias: [
    {
      nome: 'História do Brasil',
      totalTopicos: 79,
      prioridade: 1,
      blocos: [
        { bloco: 'Brasil Pré-Colonial e Colonização', rec: 'Alta', semanas: [1,2], leituras: 'Fausto HB cap.1; Linhares HGB caps.1-2; Schwarcz&Starling caps.1-4' },
        { bloco: 'Ciclo do Ouro e Reformas Pombalinas', rec: 'Média', semanas: [3], leituras: 'Ricupero Diplomacia Partes II-III; Figueiredo Rebeliões no Brasil Colônia' },
        { bloco: 'Período Joanino e Independência', rec: 'Alta', semanas: [4], leituras: 'Fausto HB cap.3; Linhares HGB cap.6; Ricupero Parte III' },
        { bloco: 'Primeiro Reinado e Regências', rec: 'Alta', semanas: [5], leituras: 'Fausto HB cap.4; Doratioto História RI cap.1; Basile O laboratório da nação' },
        { bloco: 'Segundo Reinado (Parte 1)', rec: 'Alta', semanas: [6,7], leituras: 'Fausto HB cap.5; Ricupero Parte V; Cervo HPEB cap.3' },
        { bloco: 'Segundo Reinado (Parte 2) e Guerra do Paraguai', rec: 'Alta', semanas: [8,9], leituras: 'Doratioto Maldita Guerra intro+cap.1; A construção da Ordem partes 1-2' },
        { bloco: 'Crise do Império e Proclamação da República', rec: 'Alta', semanas: [10,11], leituras: 'Angela Alonso Flores votos e balas; Teatro das Sombras cap.2' },
        { bloco: 'República Oligárquica', rec: 'Alta', semanas: [12,13], leituras: 'Fausto HB cap.6; Renato Lessa A invenção Republicana; HBN v.3' },
        { bloco: 'Política Externa Barão do Rio Branco', rec: 'Alta', semanas: [14], leituras: 'HBN caps.2-3; Ricupero Diplomacia Parte 4' },
        { bloco: 'Era Vargas (1930-1945)', rec: 'Alta', semanas: [15,16], leituras: 'Fausto HB cap.7; Doratioto RI caps.4.1-4.2; Cervo HPEB cap.10; Gerson Moura Autonomia na Dependência' },
        { bloco: '2ª Guerra e Pós-Guerra', rec: 'Alta', semanas: [17], leituras: 'Fausto HB cap.8; Gerson Moura Relações Exteriores Brasil (p.111-245)' },
        { bloco: 'Regime Militar e Abertura', rec: 'Alta', semanas: [18,19,20], leituras: 'Fausto HB caps.10-11; Cervo HPEB caps.13-14' },
      ]
    },
    {
      nome: 'História Mundial',
      totalTopicos: 60,
      prioridade: 2,
      blocos: [
        { bloco: 'Absolutismo, Mercantilismo, Revoluções Inglesas', rec: 'Alta', semanas: [1], leituras: 'Burns v.2 cap.23; Burns v.1 cap.19 item1; Hobsbawm Era Revoluções cap.2' },
        { bloco: 'Iluminismo e Revolução Francesa', rec: 'Alta', semanas: [2], leituras: 'Burns v.2 cap.21 item1; Hobsbawm Era Revoluções caps.1,3' },
        { bloco: 'Período Napoleônico e Congresso de Viena', rec: 'Alta', semanas: [3,4], leituras: 'Burns v.2 cap.22; Kissinger O Mundo Restaurado caps.9-10; Hobsbawm Era Revoluções caps.3-4' },
        { bloco: 'Liberalismo e Unificações (1820-1890)', rec: 'Alta', semanas: [5,6], leituras: 'Saraiva HRI cap.2; René Rémond Séc XIX caps.2,3,8; Hobsbawm Era do Capital caps.1,2,10' },
        { bloco: 'Imperialismo', rec: 'Alta', semanas: [7], leituras: 'Hobsbawm Era dos Impérios caps.1,2,3,6' },
        { bloco: 'Primeira Guerra Mundial', rec: 'Alta', semanas: [8], leituras: 'Hobsbawm Era dos Extremos intro+parte1 caps.1-2' },
        { bloco: 'EUA: Independência a Guerra Civil', rec: 'Média', semanas: [9,12], leituras: 'Karnal História dos EUA pp.123-172; Burns v.2 cap.27' },
        { bloco: 'América Latina: Independência e Séc. XIX', rec: 'Média', semanas: [10,11], leituras: 'Zanatta Uma Breve História AL caps.3-4; Chasteen América Latina caps.4-7' },
        { bloco: 'Fascismo, Comunismo e Contexto da 2ª Guerra', rec: 'Alta', semanas: [13,14], leituras: 'Burns v.2 cap.28; Saraiva HRI cap.4; Daniel Aarão Reis O Séc.XX; Hobsbawm Era Extremos Parte1 cap.4' },
        { bloco: 'Segunda Guerra Mundial', rec: 'Alta', semanas: [15], leituras: 'Saraiva HRI cap.5; Daniel Aarão Reis A Segunda Guerra Mundial' },
        { bloco: 'Guerra Fria', rec: 'Alta', semanas: [16,17], leituras: 'Saraiva HRI cap.6; Gaddis The Cold War: A New History; Norman Lowe cap.7' },
        { bloco: 'Descolonização e Mundo Pós-Guerra Fria', rec: 'Alta', semanas: [18,19,22], leituras: 'Saraiva HRI caps.7-8; Hobsbawm Era Extremos caps.8-9; Lowe caps.24-25' },
        { bloco: 'Cultura Sécs. XIX e XX', rec: 'Média', semanas: [24], leituras: 'Hobsbawm Era das Revoluções cap.14; Burns v.2 cap.26' },
      ]
    },
    {
      nome: 'Português',
      totalTopicos: 54,
      prioridade: 3,
      blocos: [
        { bloco: 'Funções da Linguagem e Variação Linguística', rec: 'Alta', semanas: [1], leituras: 'Cunha Nova Gramática intro+cap.2; Jakobson Linguística cap.7' },
        { bloco: 'Coesão, Coerência e Figuras de Linguagem', rec: 'Alta', semanas: [2], leituras: 'Cunha&Cintra cap.11 pp.342-355; Bechara apêndice II; listas online' },
        { bloco: 'Nova Ortografia e Figuras de Sintaxe', rec: 'Alta', semanas: [3], leituras: 'Cunha&Cintra caps.acentuação; Bechara caps.ortografia' },
        { bloco: 'Concordância Nominal e Verbal', rec: 'Alta', semanas: [4], leituras: 'Cunha&Cintra caps.concordância; Bechara caps.concordância' },
        { bloco: 'Colocação Pronominal', rec: 'Alta', semanas: [5], leituras: 'Cunha&Cintra cap.14; Bechara cap.colocação pronominal' },
        { bloco: 'Regência Verbal e Nominal', rec: 'Alta', semanas: [6], leituras: 'Cunha&Cintra cap.regências; Bechara' },
        { bloco: 'Crase', rec: 'Média', semanas: [7], leituras: 'Cunha&Cintra; Bechara' },
        { bloco: 'Produção Textual e Dissertação (TPS)', rec: 'Alta', semanas: [8], leituras: 'Treino de redações TPS; análise de espelhos de correção' },
        { bloco: 'Literatura Brasileira: Romantismo e Realismo', rec: 'Alta', semanas: [9,10], leituras: 'Bosi História concisa da literatura brasileira caps.IV-V; Candido Esquema Machado de Assis' },
        { bloco: 'Literatura Brasileira: Modernismo', rec: 'Alta', semanas: [11,12], leituras: 'Bosi caps.VI-VII; Veloso&Madeira Leituras Brasileiras caps.4-5' },
      ]
    },
    {
      nome: 'Geografia',
      totalTopicos: 46,
      prioridade: 4,
      blocos: [
        { bloco: 'Conceitos fundamentais e rede urbana', rec: 'Alta', semanas: [1,2] },
        { bloco: 'Demografia mundial e brasileira', rec: 'Alta', semanas: [3,4] },
        { bloco: 'Globalização, indústria e energia', rec: 'Alta', semanas: [5,6,7] },
        { bloco: 'Agropecuária e estrutura fundiária', rec: 'Média', semanas: [8,9] },
        { bloco: 'Geopolítica e ordenamento territorial', rec: 'Alta', semanas: [10,11] },
        { bloco: 'Biomas, recursos hídricos e meio ambiente', rec: 'Alta', semanas: [12,13] },
      ]
    },
    {
      nome: 'Política Internacional',
      totalTopicos: 53,
      prioridade: 5,
      blocos: [
        { bloco: 'ONU e Operações de Paz', rec: 'Alta', semanas: [1,2] },
        { bloco: 'Temas globais: terrorismo, narcotráfico, nuclear', rec: 'Alta', semanas: [3,4,5] },
        { bloco: 'Comércio internacional e sistema financeiro', rec: 'Alta', semanas: [6,7] },
        { bloco: 'Política Externa Brasileira (PEB)', rec: 'Alta', semanas: [8,9,10] },
        { bloco: 'Relações bilaterais do Brasil', rec: 'Alta', semanas: [11,12] },
        { bloco: 'Integrações regionais (MERCOSUL, UE, AL)', rec: 'Alta', semanas: [13,14] },
        { bloco: 'Oriente Médio e África', rec: 'Média', semanas: [15,16] },
        { bloco: 'Teorias das Relações Internacionais', rec: 'Alta', semanas: [17] },
      ]
    },
    {
      nome: 'Economia',
      totalTopicos: 46,
      prioridade: 6,
      blocos: [
        { bloco: 'Microeconomia: oferta, demanda, elasticidade', rec: 'Alta', semanas: [1,2] },
        { bloco: 'Teoria da firma e estruturas de mercado', rec: 'Alta', semanas: [3,4] },
        { bloco: 'Macroeconomia: PIB, contas nacionais', rec: 'Alta', semanas: [5,6] },
        { bloco: 'Política monetária, fiscal e cambial', rec: 'Alta', semanas: [7,8,9] },
        { bloco: 'Comércio exterior e balanço de pagamentos', rec: 'Alta', semanas: [10,11] },
        { bloco: 'Economia brasileira: do café ao Plano Real', rec: 'Alta', semanas: [12,13,14,15] },
      ]
    },
    {
      nome: 'Direito Interno',
      totalTopicos: 59,
      prioridade: 7,
      blocos: [
        { bloco: 'Teoria do Estado e Constitucionalismo', rec: 'Alta', semanas: [1,2] },
        { bloco: 'Direitos Fundamentais', rec: 'Alta', semanas: [3] },
        { bloco: 'Organização dos Poderes', rec: 'Alta', semanas: [4,5] },
        { bloco: 'Administração Pública e Atos Administrativos', rec: 'Alta', semanas: [6,7] },
        { bloco: 'Responsabilidade Civil do Estado', rec: 'Média', semanas: [8] },
        { bloco: 'Regime Jurídico do Serviço Exterior', rec: 'Alta', semanas: [9] },
        { bloco: 'Finanças Públicas', rec: 'Alta', semanas: [10] },
        { bloco: 'LINDB e DIPr', rec: 'Alta', semanas: [11] },
      ]
    },
    {
      nome: 'Direito Internacional',
      totalTopicos: 24,
      prioridade: 8,
      blocos: [
        { bloco: 'Fundamentos e fontes do DI', rec: 'Alta', semanas: [1,2] },
        { bloco: 'Direito dos Tratados (Convenção de Viena)', rec: 'Alta', semanas: [3,4] },
        { bloco: 'Estados e organizações internacionais', rec: 'Alta', semanas: [5,6,7] },
        { bloco: 'Imunidades diplomáticas e consulares', rec: 'Alta', semanas: [8,9] },
        { bloco: 'Solução de controvérsias', rec: 'Alta', semanas: [10,11] },
        { bloco: 'DI Penal, Refugiados e DI Econômico', rec: 'Alta', semanas: [12,13,14] },
      ]
    },
    {
      nome: 'Inglês',
      totalTopicos: 29,
      prioridade: 9,
      blocos: [
        { bloco: 'Compreensão e tradução de textos (TPS)', rec: 'Alta', semanas: [1,2,3] },
        { bloco: 'Gramática avançada e produção textual', rec: 'Alta', semanas: [4,5,6] },
        { bloco: 'Redação e revisão de espelhos', rec: 'Alta', semanas: [7,8] },
      ]
    },
    {
      nome: 'Espanhol',
      totalTopicos: 23,
      prioridade: 10,
      blocos: [
        { bloco: 'Gramática: tempos verbais e pronomes', rec: 'Alta', semanas: [1,2,3] },
        { bloco: 'Produção textual e compreensão leitora', rec: 'Alta', semanas: [4,5,6] },
      ]
    },
    {
      nome: 'Francês',
      totalTopicos: 24,
      prioridade: 11,
      blocos: [
        { bloco: 'Gramática: artigos, pronomes e tempos verbais', rec: 'Alta', semanas: [1,2,3] },
        { bloco: 'Produção textual e conectivos lógicos', rec: 'Alta', semanas: [4,5,6] },
      ]
    },
  ],
  tiposAtividade: {
    'aula': { label: 'Assistir aula', horas: 1.0 },
    'leitura': { label: 'Leitura obrigatória', horas: 1.5 },
    'fichamento': { label: 'Fichamento/resumo', horas: 1.0 },
    'tps': { label: 'Questões TPS', horas: 1.0 },
    'revisao': { label: 'Revisão rápida', horas: 0.5 },
  }
};

const OPENROUTER_MODEL = 'google/gemini-2.5-flash';

// Find which week of the Plano Mestre contains today's date
function getCurrentMasterWeek(planJson) {
  const today = new Date().toISOString().split('T')[0];
  if (!planJson || !planJson.semanas) return null;
  return planJson.semanas.find(s => s.dataInicio && s.dataFim && today >= s.dataInicio && today <= s.dataFim) || null;
}

module.exports = async function handler(req, res) {
  try {
    if (cors(req, res)) return;

    const user = requireAuth(req, res);
    if (!user) return;

    // GET → return plans history (replaces /api/plans-history)
    if (req.method === 'GET') {
      const supabaseG = getSupabase();
      const { data, error } = await supabaseG
        .from('daily_plans')
        .select('id, plan_date, hours_available, focus_subjects, plan_json')
        .eq('user_id', user.id)
        .order('plan_date', { ascending: false })
        .limit(30);
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const {
      horasDisponiveis,
      focoMaterias,
      observacoes,
      data: studyDate
    } = req.body || {};

    if (!horasDisponiveis || horasDisponiveis < 0.5) {
      return res.status(400).json({ error: 'Informe quantas horas você tem disponíveis (mínimo 0.5h).' });
    }

    // Buscar progresso do usuário (aulas assistidas)
    const supabase = getSupabase();
    const { data: progressData } = await supabase
      .from('progress')
      .select('lesson_id, completed, current_time_seconds')
      .eq('user_id', user.id);

    const { data: lessonsData } = await supabase
      .from('lessons')
      .select('id, title, subject_id, order_index')
      .order('order_index');

    const { data: subjectsData } = await supabase
      .from('subjects')
      .select('id, name');

    // Mapear progresso por matéria
    const progressBySubject = {};
    if (subjectsData && lessonsData && progressData) {
      const subjectMap = {};
      subjectsData.forEach(s => { subjectMap[s.id] = s.name; });

      const completedIds = new Set((progressData || []).filter(p => p.completed).map(p => p.lesson_id));

      subjectsData.forEach(s => {
        const subjectLessons = lessonsData.filter(l => l.subject_id === s.id);
        const completed = subjectLessons.filter(l => completedIds.has(l.id)).length;
        progressBySubject[s.name] = {
          total: subjectLessons.length,
          completed,
          pct: subjectLessons.length ? Math.round((completed / subjectLessons.length) * 100) : 0
        };
      });
    }

    // Fetch Plano Mestre to find current week context
    const { data: macroPlanRow } = await supabase
      .from('macro_plans')
      .select('plan_json, data_prova')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentWeek = macroPlanRow ? getCurrentMasterWeek(macroPlanRow.plan_json) : null;

    const hoje = studyDate || new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // If there's a Plano Mestre, derive focus from current week's study items
    let focoStr;
    if (focoMaterias && focoMaterias.length > 0) {
      focoStr = focoMaterias.join(', ');
    } else if (currentWeek) {
      const studySubjects = (currentWeek.materias || [])
        .filter(m => m.tipo === 'estudo' && !m.done)
        .map(m => m.nome);
      focoStr = studySubjects.length > 0 ? studySubjects.join(', ') : CACD_DATA.focoAtual.join(', ');
    } else {
      focoStr = CACD_DATA.focoAtual.join(', ');
    }

    // Progresso formatado para o prompt
    const progressoTexto = Object.entries(progressBySubject)
      .map(([mat, p]) => `- ${mat}: ${p.completed}/${p.total} aulas (${p.pct}%)`)
      .join('\n') || 'Nenhum progresso registrado ainda.';

    // Matérias com dados para o prompt
    const materiasTexto = CACD_DATA.materias.map(m => {
      const blocos = m.blocos.map(b => `  • [${b.rec}] ${b.bloco}${b.leituras ? ': ' + b.leituras : ''}`).join('\n');
      return `**${m.nome}** (${m.totalTopicos} tópicos, prioridade ${m.prioridade}):\n${blocos}`;
    }).join('\n\n');

    const systemPrompt = `Você é o Barão — um coach de estudos rigoroso e estratégico especializado no CACD (Concurso de Admissão à Carreira Diplomática do Instituto Rio Branco). Você conhece profundamente o edital, as provas anteriores e as melhores estratégias de estudo para esse concurso.\n\nSua missão é gerar planos de estudo diários personalizados, realistas e motivadores. Você prioriza tópicos de ALTA recorrência nas provas, equilibra as matérias de acordo com o tempo disponível, e sempre indica leituras específicas (livro, capítulo, páginas).\n\nResponda SEMPRE em JSON válido com a seguinte estrutura:\n{\n  "saudacao": "mensagem motivadora curta (1-2 frases) personalizada para o dia",\n  "resumoDia": "resumo estratégico do plano (2-3 frases explicando a lógica por trás da distribuição)",\n  "blocos": [\n    {\n      "horario": "ex: 08:00 – 09:30",\n      "materia": "nome da matéria",\n      "atividade": "tipo: aula | leitura | fichamento | tps | revisao",\n      "titulo": "título específico do que fazer (ex: 'Aula 3 – Era Vargas: Estado Novo')",\n      "descricao": "instrução detalhada: o que ler, qual aula assistir, quais capítulos, etc.",\n      "duracaoMin": 90,\n      "recorrencia": "Alta | Média | Baixa"\n    }\n  ],\n  "pausas": [\n    { "horario": "ex: 09:30 – 09:45", "tipo": "Pausa curta" }\n  ],\n  "dicaDoDia": "dica específica de técnica de estudo para o CACD (ex: como fazer fichamento eficiente, como treinar TPS, etc.)",\n  "totalHorasEstudo": 3.5\n}`;

    // Build Plano Mestre week context string
    let macroPlanContext = '';
    if (currentWeek) {
      const semanaNum = currentWeek.semana;
      const daysToExam = macroPlanRow.data_prova
        ? Math.max(0, Math.floor((new Date(macroPlanRow.data_prova) - new Date()) / 86400000))
        : null;

      const itemLines = (currentWeek.materias || []).map(m => {
        const status = m.done ? '✅ Concluído' : '⬜ Pendente';
        const tipo = m.tipo === 'revisao' ? '[REVISÃO ESPAÇADA]' : '[ESTUDO]';
        const leit = m.leituras ? ` — Leituras: ${m.leituras}` : '';
        return `  ${tipo} ${m.nome}: ${m.topico} ${status}${leit}`;
      }).join('\n');

      macroPlanContext = `\n\n## Plano Mestre — Semana ${semanaNum} (semana atual):
${daysToExam !== null ? `Faltam ${daysToExam} dias para a prova.\n` : ''}${itemLines}

⚠️ O plano de hoje DEVE ser coerente com esta semana do Plano Mestre:
- Priorize os itens de ESTUDO pendentes (⬜) desta semana
- Para itens de REVISÃO ESPAÇADA pendentes, inclua um bloco de exercícios
- Itens já marcados como ✅ Concluído podem ser omitidos ou apenas revisados brevemente
- Adapte a carga horária ao tempo disponível (${horasDisponiveis}h)`;
    }

    const userPrompt = `# Plano de estudos para hoje

**Data:** ${hoje}
**Horas disponíveis:** ${horasDisponiveis}h
**Matérias em foco atual:** ${focoStr}
${observacoes ? `**Observações do estudante:** ${observacoes}` : ''}

## Progresso atual nas aulas (EduFlow):
${progressoTexto}${macroPlanContext}

## Estrutura completa do CACD (${CACD_DATA.totalTopicos} tópicos no total):
${materiasTexto}

## Instruções para gerar o plano:
1. Distribua as ${horasDisponiveis}h priorizando as matérias em foco: ${focoStr}
2. Dentro de cada matéria, priorize tópicos de ALTA recorrência
3. Inclua pausas estratégicas (5min a cada 25min ou 15min a cada 90min)
4. Indique leituras ESPECÍFICAS com livro + capítulo/páginas sempre que disponível
5. Varie os tipos de atividade (não coloque só leituras ou só aulas seguidas)
6. Para tópicos com aulas disponíveis no EduFlow, sugira assistir a aula específica
7. Se houver menos de 2h, foque em 1-2 matérias apenas com alta prioridade
8. Os horários devem começar às 08:00 por padrão (ajuste para o contexto)
9. Seja específico: não diga "estude história", diga "Leia Fausto HB cap.4 pp.141-180: Primeiro Reinado"
10. Retorne SOMENTE o JSON, sem markdown adicional`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://eduflow.vercel.app',
        'X-Title': 'EduFlow CACD Coach',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenRouter error:', errText);
      return res.status(502).json({ error: 'Erro ao chamar o modelo de IA: ' + errText.substring(0, 200) });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(502).json({ error: 'Resposta vazia do modelo de IA.' });
    }

    let plano;
    try {
      plano = JSON.parse(content);
    } catch (e) {
      const match = content.match(/```json\n?([\s\S]+?)\n?```/) || content.match(/({[\s\S]+})/);
      if (match) {
        plano = JSON.parse(match[1]);
      } else {
        console.error('JSON parse error, content:', content);
        return res.status(502).json({ error: 'Resposta do modelo não está em formato válido.' });
      }
    }

    // Salvar plano no banco
    const saveDate = studyDate || new Date().toISOString().split('T')[0];
    await supabase.from('daily_plans').upsert({
      user_id: user.id,
      plan_date: saveDate,
      hours_available: horasDisponiveis,
      focus_subjects: focoStr,
      plan_json: plano,
    }, { onConflict: 'user_id,plan_date' });

    // Attach current master week so frontend can render it
    if (currentWeek) plano._masterWeek = currentWeek;

    return res.status(200).json(plano);

  } catch (err) {
    console.error('Generate plan error:', err);
    return res.status(500).json({ error: 'Erro interno: ' + (err.message || 'desconhecido') });
  }
};
