/* ============================================================
   API CLIENT
   ============================================================ */
var _store = window['local' + 'Storage'];
var API = {
    getToken: function() { try { return _store.getItem('eduflow_token'); } catch(e) { return null; } },
    setToken: function(t) { try { _store.setItem('eduflow_token', t); } catch(e) { /* noop */ } },
    clearToken: function() { try { _store.removeItem('eduflow_token'); } catch(e) { /* noop */ } },

    request: function(method, url, body) {
        var headers = { 'Content-Type': 'application/json' };
        var token = this.getToken();
        if (token) headers['Authorization'] = 'Bearer ' + token;
        var opts = { method: method, headers: headers };
        if (body) opts.body = JSON.stringify(body);
        return fetch(url, opts).then(function(res) {
            var contentType = res.headers.get('content-type') || '';
            if (contentType.indexOf('application/json') === -1) {
                return res.text().then(function(text) {
                    throw new Error(res.ok ? text : 'Erro do servidor (HTTP ' + res.status + '): ' + (text || '').substring(0, 120));
                });
            }
            return res.json().then(function(data) {
                if (!res.ok) throw new Error(data.error || 'Erro na requisição');
                return data;
            });
        });
    },

    login: function(username, password) { return this.request('POST', '/api/auth', { action: 'login', username: username, password: password }); },
    getMe: function() { return this.request('GET', '/api/auth'); },

    getUsers: function() { return this.request('GET', '/api/users'); },
    createUser: function(data) { return this.request('POST', '/api/users', data); },
    updateUser: function(id, data) { return this.request('PUT', '/api/users?id=' + id, data); },
    deleteUser: function(id) { return this.request('DELETE', '/api/users?id=' + id); },

    getSubjects: function() { return this.request('GET', '/api/subjects'); },
    createSubject: function(data) { return this.request('POST', '/api/subjects', data); },
    updateSubject: function(id, data) { return this.request('PUT', '/api/subjects?id=' + id, data); },
    deleteSubject: function(id) { return this.request('DELETE', '/api/subjects?id=' + id); },

    getLessons: function(subjectId) { return this.request('GET', '/api/lessons?subjectId=' + subjectId); },
    createLesson: function(data) { return this.request('POST', '/api/lessons', data); },
    updateLesson: function(id, data) { return this.request('PUT', '/api/lessons?id=' + id, data); },
    deleteLesson: function(id) { return this.request('DELETE', '/api/lessons?id=' + id); },
    reorderLesson: function(lessonId, direction) { return this.request('PUT', '/api/lessons', { lessonId: lessonId, direction: direction }); },

    getProgress: function(lessonId) { return this.request('GET', '/api/progress' + (lessonId ? '?lessonId=' + lessonId : '')); },
    saveProgress: function(data) { return this.request('POST', '/api/progress', data); },

    resetPassword: function(token, username, newPassword) { return this.request('POST', '/api/auth', { action: 'reset', token: token, username: username, newPassword: newPassword }); },

    generateMacroPlan: function(data) { return this.request('POST', '/api/generate-macro-plan', data); },
    getPlansHistory: function() { return this.request('GET', '/api/generate-plan'); },
    generateQuestions: function(data) { return this.request('POST', '/api/generate-questions', data); },
    getQuestions: function(params) {
        var qs = Object.keys(params||{}).map(function(k){return k+'='+encodeURIComponent(params[k]);}).join('&');
        return this.request('GET', '/api/questions' + (qs ? '?' + qs : ''));
    },
    createSimulado: function(data) { return this.request('POST', '/api/simulado', Object.assign({action:'create'}, data)); },
    submitSimulado: function(simuladoId, respostas) { return this.request('POST', '/api/simulado', {action:'submit', simuladoId:simuladoId, respostas:respostas}); },
    saveSimulado: function(simuladoId, respostas, elapsedSeconds) { return this.request('POST', '/api/simulado', {action:'save', simuladoId:simuladoId, respostas:respostas, elapsedSeconds:elapsedSeconds}); },
    cancelSimulado: function(simuladoId) { return this.request('POST', '/api/simulado', {action:'cancel', simuladoId:simuladoId}); },
    getActiveSimulado: function() { return this.request('GET', '/api/simulado?active=true'); },
    getOngoingSimulados: function() { return this.request('GET', '/api/simulado?ongoing=true'); },
    getSimulados: function(limit) { return this.request('GET', '/api/simulado' + (limit ? '?limit='+limit : '')); }
};

/* ============================================================
   LOCAL VISUAL PREVIEW
   ============================================================ */
function isVisualPreview() {
    try {
        return window.location.protocol === 'file:' || new URLSearchParams(window.location.search).get('preview') === '1';
    } catch(e) {
        return false;
    }
}

function enableVisualPreview() {
    var previewUser = { id: 1, name: 'Rafael Ordinani', username: 'rafael', role: 'student' };
    var subjects = [
        {id:1,name:'Português',description:'Gramática, literatura, interpretação e redação.'},
        {id:2,name:'História do Brasil',description:'Do período colonial à política externa brasileira.'},
        {id:3,name:'História Mundial',description:'Processos históricos e relações internacionais.'},
        {id:4,name:'Inglês',description:'Leitura, vocabulário e interpretação diplomática.'},
        {id:5,name:'Francês',description:'Leitura e domínio instrumental.'},
        {id:6,name:'Espanhol',description:'Compreensão e vocabulário de prova.'},
        {id:7,name:'Economia',description:'Micro, macro e economia brasileira.'},
        {id:8,name:'Direito Interno',description:'Constitucional, administrativo e organização do Estado.'},
        {id:9,name:'Geografia',description:'Geopolítica, território, ambiente e urbanização.'},
        {id:10,name:'Direito Internacional',description:'Tratados, organizações e prática diplomática.'},
        {id:11,name:'Política Internacional',description:'Teoria, organismos, integração e conflitos.'}
    ];
    var counts = {1:48,2:120,3:26,4:24,5:24,6:24,7:30,8:16,9:30,10:24,11:34};
    var complete = {1:0,2:1,3:1,4:0,5:0,6:0,7:0,8:0,9:0,10:0,11:0};
    var lessonsBySubject = {};
    var progress = [];
    subjects.forEach(function(s) {
        var total = counts[s.id] || 12;
        lessonsBySubject[s.id] = Array.from({length: total}, function(_, i) {
            return { id: s.id * 1000 + i + 1, subject_id: s.id, title: i === 0 ? 'Ciclo do Ouro e Reformas Pombalinas' : 'Aula ' + (i + 1), duration_minutes: 45, order_index: i + 1 };
        });
        for (var i = 0; i < (complete[s.id] || 0); i++) {
            progress.push({ lesson_id: s.id * 1000 + i + 1, current_time_seconds: 1200, completed: true, last_accessed: '2026-06-16' });
        }
    });
    var macroPlan = {
        resumo:'Todas as 4 aulas foram distribuídas com até 2 aulas por dia, 1 dia de descanso por semana e revisões em D+1, D+7 e D+30.',
        macro_plan_version:5,modoPlanejamento:'aulas_por_dia',aulasPorDia:2,diasDescansoPorSemana:1,dataProva:null,totalAulas:4,totalRevisoes:12,totalDiasEstudo:2,totalDiasAulas:2,totalDias:32,totalSemanas:5,totalHoras:10,dataInicio:'2026-06-06',dataFimAulas:'2026-06-07',dataFim:'2026-07-07',
        semanas:[
            {semana:1,dataInicio:'2026-06-06',dataFim:'2026-06-12',datasDescanso:['2026-06-12'],materias:[
                {id:'lesson-2001',subject_id:2,lesson_id:2001,lesson_title:'Ciclo do Ouro e Reformas Pombalinas',tipo:'estudo',nome:'História do Brasil',topico:'Ciclo do Ouro e Reformas Pombalinas',data:'2026-06-06',dia:1,atividades:[{tipo:'aula',descricao:'Assistir à aula',horas:1}],done:true},
                {id:'lesson-3001',subject_id:3,lesson_id:3001,lesson_title:'Aula introdutória',tipo:'estudo',nome:'História Mundial',topico:'Aula introdutória',data:'2026-06-06',dia:1,atividades:[{tipo:'aula',descricao:'Assistir à aula',horas:1}],done:false},
                {id:'lesson-1001',subject_id:1,lesson_id:1001,lesson_title:'Aula introdutória',tipo:'estudo',nome:'Português',topico:'Aula introdutória',data:'2026-06-07',dia:2,atividades:[{tipo:'aula',descricao:'Assistir à aula',horas:1}],done:false},
                {id:'lesson-2002',subject_id:2,lesson_id:2002,lesson_title:'Aula 2',tipo:'estudo',nome:'História do Brasil',topico:'Aula 2',data:'2026-06-07',dia:2,atividades:[{tipo:'aula',descricao:'Assistir à aula',horas:1}],done:false},
                {id:'review-2001-d1',subject_id:2,lesson_id:2001,lesson_title:'Ciclo do Ouro e Reformas Pombalinas',review_of_id:'lesson-2001',review_interval_days:1,tipo:'revisao',nome:'História do Brasil',topico:'Revisão espaçada (D+1): Ciclo do Ouro e Reformas Pombalinas',data:'2026-06-07',dia:2,atividades:[{tipo:'revisao',descricao:'Revisar a aula',horas:.5}],done:false}
            ]}
        ]
    };
    var todayPlan = {
        plan_date:'2026-06-16',hours_available:3,focus_subjects:'História do Brasil, História Mundial, Português',
        plan_json:{saudacao:'Bom estudo. Hoje o foco é avançar com serenidade.',resumoDia:'Três blocos objetivos para consolidar a semana do Plano Mestre.',totalHorasEstudo:3,blocos:[
            {horario:'08:00 - 09:00',duracaoMin:60,titulo:'História do Brasil',descricao:'Ciclo do Ouro e Reformas Pombalinas',materia:'História do Brasil',tipo:'Estudo'},
            {horario:'09:15 - 10:15',duracaoMin:60,titulo:'História Mundial',descricao:'Iluminismo e Revolução Francesa',materia:'História Mundial',tipo:'Estudo'},
            {horario:'10:30 - 11:30',duracaoMin:60,titulo:'Português',descricao:'Coesão, coerência e figuras de linguagem',materia:'Português',tipo:'Estudo'}
        ],dicaDoDia:'Finalize cada bloco anotando uma pergunta que você ainda não sabe responder.'}
    };
    var performance = {
        overall:{total:4,correct:1,accuracy:25,subjects_with_data:1},
        subjects:[{subject:'História do Brasil',accuracy:25,correct:1,total:4},{subject:'Português',accuracy:62,correct:5,total:8},{subject:'História Mundial',accuracy:48,correct:6,total:12}],
        weakSubjects:[{subject:'História do Brasil',accuracy:25,correct:1,total:4}],
        weakTopics:[{subject:'História do Brasil',topic:'M1A1 - PERÍODO COLONIAL',accuracy:25,correct:1,total:4}]
    };
    function delayed(data) { return Promise.resolve(JSON.parse(JSON.stringify(data))); }
    API.getToken = function() { return 'preview-token'; };
    API.setToken = function() {};
    API.clearToken = function() {};
    API.login = function() { return delayed({ token:'preview-token', user:previewUser }); };
    API.getMe = function() { return delayed({ user:previewUser }); };
    API.getSubjects = function() { return delayed(subjects); };
    API.getLessons = function(subjectId) { return delayed(lessonsBySubject[subjectId] || []); };
    API.getProgress = function(lessonId) {
        if (!lessonId) return delayed(progress);
        return delayed(progress.filter(function(p) { return p.lesson_id === lessonId; }));
    };
    API.getPlansHistory = function() { return delayed([todayPlan]); };
    API.generateMacroPlan = function() { return delayed(macroPlan); };
    API.generateQuestions = function() { return delayed({ questoes: [] }); };
    API.createSimulado = function() { return delayed({ simuladoId:1, questoes: [] }); };
    API.submitSimulado = function() { return delayed({ score:0,total:1,questoes_with_gabarito:[],subject_stats:{} }); };
    API.saveSimulado = function() { return delayed({ simulado: null }); };
    API.cancelSimulado = function() { return delayed({ ok: true }); };
    API.getActiveSimulado = function() { return delayed({ simulado: null }); };
    API.getOngoingSimulados = function() { return delayed({ simulados: [] }); };
    API.request = function(method, url, body) {
        if (url.indexOf('/api/generate-macro-plan') === 0) return delayed({ created_at:'2026-06-06T12:00:00Z', data_prova:'2027-08-06', plan_json:macroPlan });
        if (url.indexOf('/api/generate-plan') === 0 && method === 'GET') return delayed([todayPlan]);
        if (url.indexOf('/api/generate-plan') === 0 && method === 'POST') return delayed(todayPlan.plan_json);
        if (url.indexOf('/api/performance?action=macro') === 0) return delayed({ data_prova:'2026-06-07', plan_json:macroPlan });
        if (url.indexOf('/api/performance?action=study') === 0) return delayed([{subject:'História do Brasil',duration_minutes:70,started_at:'2026-06-16T12:00:00Z'},{subject:'Português',duration_minutes:45,started_at:'2026-06-15T12:00:00Z'}]);
        if (url.indexOf('/api/performance') === 0) return delayed(performance);
        if (url.indexOf('/api/baron-chat') === 0) return delayed({ reply:'Modo preview ativo. Navegue livremente para revisar o visual.' });
        return delayed({});
    };
    function rewriteLocalAssets() {
        document.querySelectorAll('img[src^="/"]').forEach(function(img) {
            img.setAttribute('src', img.getAttribute('src').replace(/^\//, ''));
        });
    }
    var observer = new MutationObserver(function() {
        rewriteLocalAssets();
    });
    observer.observe(document.documentElement, { childList:true, subtree:true });
    rewriteLocalAssets();
}
if (isVisualPreview()) enableVisualPreview();

/* ============================================================
   STATE
   ============================================================ */
var state = { view: 'login', user: null, selectedSubjectId: null, selectedLessonId: null, resetToken: null };

/* ============================================================
   UTILITIES
   ============================================================ */
function escapeHtml(t) { var d = document.createElement('div'); d.textContent = t || ''; return d.innerHTML; }

// Renders enunciado separating context text (before |) from item text (after |)
function renderEnunciado(enunciado) {
    if (!enunciado) return '';
    var parts = enunciado.split(' | ');
    if (parts.length === 1) return '<p style="font-size:.9rem;line-height:1.6;margin:0">' + escapeHtml(enunciado) + '</p>';
    var context = parts.slice(0, parts.length - 1).join(' | ');
    var item = parts[parts.length - 1];
    return '<blockquote style="margin:0 0 10px 0;padding:10px 14px;background:var(--surface-hover);border-left:3px solid var(--primary);border-radius:0 var(--radius-sm) var(--radius-sm) 0;font-size:.85rem;line-height:1.6;color:var(--text-secondary);font-style:italic">' + escapeHtml(context) + '</blockquote>' +
           '<p style="font-size:.9rem;line-height:1.6;margin:0">' + escapeHtml(item) + '</p>';
}
function formatTime(s) { return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0'); }
// Safe single-quoted JS string literal for use inside HTML onclick="..." attributes
function _js(s) { return "'" + String(s == null ? '' : s).replace(/\\/g,'\\\\').replace(/'/g,"\\'") + "'"; }
function _jsNull(s) { return (s == null) ? 'null' : _js(s); }
function subjectIcon(name) {
    var map = {
        'Português':'fa-book-open','História do Brasil':'fa-landmark','História Mundial':'fa-globe',
        'Inglês':'fa-flag','Francês':'fa-language','Espanhol':'fa-church','Economia':'fa-chart-line',
        'Direito Interno':'fa-scale-balanced','Direito Internacional':'fa-earth-americas',
        'Geografia':'fa-compass','Política Internacional':'fa-building-columns'
    };
    return map[name] || 'fa-book';
}
function zenTitle(icon, title, subtitle) {
    return '<div class="zen-page-title"><div class="zen-title-icon"><i class="fas ' + icon + '"></i></div><div><h1>' + escapeHtml(title) + '</h1>' +
        (subtitle ? '<p>' + escapeHtml(subtitle) + '</p>' : '') + '</div></div>';
}
function zenHero(title, text, img) {
    return '<div class="zen-hero">' +
        (img ? '<img class="zen-hero-avatar" src="' + img + '" alt="Barão" onerror="this.src=\'/baron-avatar.png\'">' : '') +
        '<div><h1>' + escapeHtml(title) + '</h1><p>' + escapeHtml(text) + '</p></div>' +
    '</div>';
}

/* CACD topics per subject for classification */
var CACD_TOPICS = {
    'Português': ['Interpretação de texto','Linguística textual','Gramática e sintaxe','Semântica e léxico','Literatura brasileira','Redação e estilo','Coerência e coesão'],
    'Inglês': ['Reading comprehension','Vocabulary in context','Grammar and usage','Text interpretation','Diplomacy texts','International relations texts'],
    'História do Brasil': ['Brasil Colônia','Independência e Império','República Velha','Era Vargas','Democracia 1945-64','Regime Militar','Redemocratização','Política Externa Brasileira','Economia brasileira'],
    'História Mundial': ['Idade Moderna','Século XIX e Imperialismo','Primeira Guerra Mundial','Entreguerras','Segunda Guerra Mundial','Guerra Fria','Ordem pós-bipolar','América Latina','Ásia e África'],
    'Política Internacional': ['Teoria das Relações Internacionais','Organismos internacionais','MERCOSUL e integração regional','Política externa comparada','Conflitos contemporâneos','Direitos humanos internacionais','Segurança internacional'],
    'Economia': ['Microeconomia','Macroeconomia','Comércio internacional','Economia brasileira contemporânea','Finanças internacionais','Desenvolvimento econômico','Teoria econômica'],
    'Direito Interno': ['Direito Constitucional','Direito Administrativo','Direito Civil','Direito do Trabalho','Processo Civil','Organização do Estado'],
    'Direito Internacional': ['Direito Internacional Público','Tratados internacionais','Organizações internacionais','Imunidade diplomática','Direito do mar','Direito humanitário'],
    'Geografia': ['Geopolítica','Geografia econômica','Questão ambiental','Urbanização','Brasil: espaço e território','Globalização e território']
};

function buildTopicBadge(questionId, subject, topic) {
    if (topic) {
        return '<span class="topic-badge definido" title="Tópico: ' + escapeHtml(topic) + '"><i class="fas fa-tag" style="font-size:.65rem"></i>' + escapeHtml(topic) + '</span>';
    }
    if (!questionId) return '';
    return '<span class="topic-badge indefinido" onclick="abrirModalTopico(' + _js(questionId) + ',' + _js(subject) + ')" title="Clique para classificar o tópico desta questão"><i class="fas fa-question-circle" style="font-size:.65rem"></i> indefinido</span>';
}

function abrirModalTopico(questionId, subject) {
    var topics = CACD_TOPICS[subject] || [];
    var topicsHtml = topics.map(function(t) {
        return '<div class="topic-option" onclick="salvarTopico(' + _js(questionId) + ',' + _js(t) + ',this)">' +
            '<i class="fas fa-tag" style="color:var(--primary);font-size:.8rem"></i>' + escapeHtml(t) + '</div>';
    }).join('');
    var overlay = document.createElement('div');
    overlay.className = 'topic-modal-overlay';
    overlay.id = 'topic-modal-overlay';
    overlay.innerHTML = '<div class="topic-modal">' +
        '<h3><i class="fas fa-tag" style="color:var(--primary);margin-right:8px"></i>Classificar tópico</h3>' +
        '<p style="font-size:.85rem;color:var(--text-muted);margin-bottom:16px">Matéria: <strong>' + escapeHtml(subject) + '</strong>. Selecione o tópico:</p>' +
        '<div style="max-height:300px;overflow-y:auto">' + topicsHtml + '</div>' +
        '<button class="btn btn-secondary" style="margin-top:16px;width:100%" onclick="fecharModalTopico()">Cancelar</button>' +
    '</div>';
    overlay.addEventListener('click', function(e) { if (e.target === overlay) fecharModalTopico(); });
    document.body.appendChild(overlay);
}

function fecharModalTopico() {
    var el = document.getElementById('topic-modal-overlay');
    if (el) el.remove();
}

function salvarTopico(questionId, topic, optEl) {
    API.request('POST', '/api/questions', { action: 'update-topic', id: questionId, topic: topic }).then(function() {
        // Update all badges for this question
        document.querySelectorAll('[data-qid="' + questionId + '"]').forEach(function(badge) {
            badge.className = 'topic-badge definido';
            badge.title = 'Tópico: ' + topic;
            badge.innerHTML = '<i class="fas fa-tag" style="font-size:.65rem"></i>' + escapeHtml(topic);
            badge.removeAttribute('onclick');
        });
        fecharModalTopico();
        showToast('Tópico salvo: ' + topic, 'success');
    }).catch(function(err) { showToast('Erro ao salvar tópico: ' + err.message, 'error'); });
}

var _baronPoseTimer = null;
var BARON_POSES = {
    neutral:  '/baron-neutral-sm.png',
    pointing: '/baron-pointing-sm.png',
    reading:  '/baron-reading-sm.png',
    thumbsup: '/baron-thumbsup-sm.png',
    thinking: '/baron-thinking-sm.png',
    winking:  '/baron-winking-sm.png'
};
var BARON_TIPS = [
    'Estude pelo menos 4h/dia para passar no CACD.',
    'Questões antigas são o melhor treino!',
    'Revise o que errou — é onde mais aprende.',
    'Foco em Português e História do Brasil.',
    'Use o simulado para testar seu tempo.',
    'Leia o Rezek para Direito Internacional.',
    'Cervo & Bueno é essencial para a HPEB.',
    'Pratique redação dissertativa toda semana.'
];
function baronFloatPose(pose, duration) {
    var img = document.getElementById('baron-float-img');
    if (!img) return;
    if (_baronPoseTimer) clearTimeout(_baronPoseTimer);
    img.style.transition = 'opacity .25s';
    img.style.opacity = '0';
    setTimeout(function() {
        img.src = BARON_POSES[pose] || BARON_POSES.neutral;
        img.style.opacity = '1';
    }, 250);
    _baronPoseTimer = setTimeout(function() {
        img.style.opacity = '0';
        setTimeout(function() { img.src = BARON_POSES.winking; img.style.opacity = '1'; }, 250);
    }, duration || 3000);
}
function baronShowSpeech(msg) {
    var el = document.getElementById('baron-speech');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(function() { el.style.display = 'none'; }, 5000);
}
function baronRandomTip() {
    baronFloatPose('pointing', 6000);
    baronShowSpeech(BARON_TIPS[Math.floor(Math.random() * BARON_TIPS.length)]);
}
// Show random tip every 5 minutes while studying
setInterval(function() {
    var fl = document.getElementById('baron-float');
    if (fl && fl.style.display !== 'none') baronRandomTip();
}, 300000);

/* ============================================================
   BARÃO CHAT
   ============================================================ */
var _baronChatOpen = false;
var _baronMessages = [];

function toggleBaronChat() {
    _baronChatOpen = !_baronChatOpen;
    var modal = document.getElementById('baron-chat-modal');
    if (!modal) return;
    modal.style.display = _baronChatOpen ? 'flex' : 'none';
    if (_baronChatOpen) {
        loadBaronHistory();
        document.getElementById('baron-chat-input').focus();
    }
}

function loadBaronHistory() {
    // Messages are already stored in _baronMessages; re-render if container is empty
    var msgs = document.getElementById('baron-chat-messages');
    if (!msgs) return;
    if (msgs.children.length === 0 && _baronMessages.length === 0) {
        // Show welcome message on first open
        appendBaronMessage('assistant', 'Olá! Sou o Barão, seu coach para o CACD. Como posso ajudar você hoje?');
    }
}

function appendBaronMessage(role, text) {
    _baronMessages.push({role: role, text: text});
    var msgs = document.getElementById('baron-chat-messages');
    if (!msgs) return;
    var isUser = role === 'user';
    var div = document.createElement('div');
    div.style.cssText = 'display:flex;gap:8px;align-items:flex-end;' + (isUser ? 'flex-direction:row-reverse' : '');
    div.innerHTML = (isUser ? '' : '<img src="/baron-neutral-sm.png" style="width:28px;height:28px;border-radius:50%;flex-shrink:0" onerror="this.style.display=\'none\'">') +
        '<div style="max-width:80%;padding:8px 12px;border-radius:' + (isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px') + ';background:' + (isUser ? 'var(--primary)' : 'var(--primary-light)') + ';color:' + (isUser ? '#fff' : 'var(--text)') + ';font-size:.83rem;line-height:1.5">' + escapeHtml(text) + '</div>';
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
}

function sendBaronMessage() {
    var input = document.getElementById('baron-chat-input');
    var text = (input ? input.value : '').trim();
    if (!text) return;
    input.value = '';
    appendBaronMessage('user', text);
    // Show typing indicator
    var msgs = document.getElementById('baron-chat-messages');
    var typing = document.createElement('div');
    typing.id = 'baron-typing';
    typing.style.cssText = 'display:flex;gap:8px;align-items:center;font-size:.8rem;color:var(--text-muted)';
    typing.innerHTML = '<img src="/baron-reading-sm.png" style="width:24px;height:24px;border-radius:50%" onerror="this.style.display=\'none\'"><span>Barão está digitando…</span>';
    if (msgs) msgs.appendChild(typing);
    baronFloatPose('reading', 8000);
    API.request('POST', '/api/baron-chat', { message: text }).then(function(data) {
        var t = document.getElementById('baron-typing');
        if (t) t.remove();
        appendBaronMessage('assistant', data.reply || '');
        baronFloatPose('pointing', 3000);
    }).catch(function() {
        var t = document.getElementById('baron-typing');
        if (t) t.remove();
        appendBaronMessage('assistant', 'Desculpe, tive um problema. Tente novamente.');
    });
}

// Send on Enter key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && _baronChatOpen) {
        var input = document.getElementById('baron-chat-input');
        if (document.activeElement === input) sendBaronMessage();
    }
});

/* ============================================================
   STUDY TIMER
   ============================================================ */
var STUDY_TIMER_STORAGE_KEY = 'eduflow.studyTimer';
var DEFAULT_STUDY_TIMER_MINUTES = 25;
var _studyTimerInterval = null;
var _studyTimerState = loadStudyTimerState();
var _studyTimerAudioContext = null;
var _studyTimerLastCompleted = null;

function loadStudyTimerState() {
    try {
        var raw = localStorage.getItem(STUDY_TIMER_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function saveStudyTimerState() {
    if (_studyTimerState) localStorage.setItem(STUDY_TIMER_STORAGE_KEY, JSON.stringify(_studyTimerState));
    else localStorage.removeItem(STUDY_TIMER_STORAGE_KEY);
}

function formatTimerSeconds(totalSeconds) {
    totalSeconds = Math.max(0, Math.ceil(totalSeconds || 0));
    var h = Math.floor(totalSeconds / 3600);
    var m = Math.floor((totalSeconds % 3600) / 60);
    var s = totalSeconds % 60;
    if (h > 0) return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}

function getStudyTimerRemainingSeconds() {
    if (!_studyTimerState) return DEFAULT_STUDY_TIMER_MINUTES * 60;
    if (_studyTimerState.status === 'paused') return Math.max(0, Math.ceil((_studyTimerState.remainingMs || 0) / 1000));
    return Math.max(0, Math.ceil((_studyTimerState.endAt - Date.now()) / 1000));
}

function getStudyTimerProgressPercent() {
    if (!_studyTimerState || !_studyTimerState.durationMinutes) return 0;
    var total = _studyTimerState.durationMinutes * 60;
    var remaining = getStudyTimerRemainingSeconds();
    return Math.max(0, Math.min(100, ((total - remaining) / total) * 100));
}

function selectStudyTimerDuration(minutes, el) {
    var input = document.getElementById('timer-duration');
    if (input) input.value = minutes;
    var buttons = document.querySelectorAll('.timer-duration-preset');
    buttons.forEach(function(btn) { btn.classList.remove('active'); });
    if (el) el.classList.add('active');
}

function syncStudyTimerDurationPreset() {
    var input = document.getElementById('timer-duration');
    var value = input ? String(parseInt(input.value, 10) || '') : '';
    var buttons = document.querySelectorAll('.timer-duration-preset');
    buttons.forEach(function(btn) {
        btn.classList.toggle('active', btn.getAttribute('data-minutes') === value);
    });
}

function startAnotherStudyTimer(minutes) {
    if (_studyTimerLastCompleted && _studyTimerLastCompleted.subject) {
        var subject = document.getElementById('timer-subject');
        if (subject) subject.value = _studyTimerLastCompleted.subject;
    }
    _studyTimerLastCompleted = null;
    selectStudyTimerDuration(minutes || DEFAULT_STUDY_TIMER_MINUTES);
    updateStudyTimerUI();
}

function openStudyTimer() {
    updateStudyTimerUI();
    document.getElementById('study-timer-modal').style.display = 'block';
    document.getElementById('study-timer-overlay').style.display = 'block';
}

function closeStudyTimer() {
    document.getElementById('study-timer-modal').style.display = 'none';
    document.getElementById('study-timer-overlay').style.display = 'none';
}

function startStudyTimer() {
    if (_studyTimerState && _studyTimerState.status === 'paused') {
        resumeStudyTimer();
        return;
    }
    var subject = document.getElementById('timer-subject').value;
    var durationInput = document.getElementById('timer-duration');
    var durationMin = Math.max(1, Math.min(240, parseInt(durationInput.value, 10) || DEFAULT_STUDY_TIMER_MINUTES));
    if (!subject) { showToast('Selecione uma matéria', 'error'); return; }
    durationInput.value = durationMin;
    var now = Date.now();
    _studyTimerState = {
        subject: subject,
        durationMinutes: durationMin,
        startedAt: new Date(now).toISOString(),
        endAt: now + durationMin * 60000,
        status: 'running'
    };
    saveStudyTimerState();
    prepareStudyTimerAudio();
    ensureStudyTimerInterval();
    updateStudyTimerUI();
    baronFloatPose('reading', durationMin * 60000);
}

function pauseStudyTimer() {
    if (!_studyTimerState) return;
    if (_studyTimerState.status === 'paused') {
        resumeStudyTimer();
        return;
    }
    _studyTimerState.remainingMs = Math.max(0, _studyTimerState.endAt - Date.now());
    _studyTimerState.status = 'paused';
    saveStudyTimerState();
    updateStudyTimerUI();
}

function resumeStudyTimer() {
    if (!_studyTimerState) return;
    var remainingMs = Math.max(1000, _studyTimerState.remainingMs || DEFAULT_STUDY_TIMER_MINUTES * 60000);
    _studyTimerState.endAt = Date.now() + remainingMs;
    _studyTimerState.remainingMs = null;
    _studyTimerState.status = 'running';
    saveStudyTimerState();
    prepareStudyTimerAudio();
    ensureStudyTimerInterval();
    updateStudyTimerUI();
    baronFloatPose('reading', remainingMs);
}

function cancelStudyTimer() {
    if (!_studyTimerState) return;
    _studyTimerState = null;
    saveStudyTimerState();
    updateStudyTimerUI();
    showToast('Timer cancelado.', 'info');
}

function stopStudyTimer() {
    finishStudyTimer(false);
}

function finishStudyTimer(completed) {
    if (!_studyTimerState) return;
    var finishedState = _studyTimerState;
    _studyTimerState = null;
    _studyTimerLastCompleted = completed ? finishedState : null;
    saveStudyTimerState();
    updateStudyTimerUI();
    if (completed) playStudyTimerAlert();

    API.request('POST', '/api/performance', {
        subject: finishedState.subject,
        durationMinutes: finishedState.durationMinutes,
        startedAt: finishedState.startedAt
    }).catch(function(){});

    var msg = completed
        ? 'Timer concluído: ' + finishedState.durationMinutes + ' min de ' + finishedState.subject + '!'
        : 'Sessão de ' + finishedState.durationMinutes + ' min de ' + finishedState.subject + ' registrada!';
    updateStudyTimerUI();
    showToast(msg, 'success');
    baronFloatPose('thumbsup', 4000);
    baronShowSpeech(completed ? 'Tempo concluído. Faça uma pausa breve e volte com foco.' : 'Ótima sessão registrada.');
}

function ensureStudyTimerInterval() {
    if (_studyTimerInterval) return;
    _studyTimerInterval = setInterval(tickStudyTimer, 1000);
}

function tickStudyTimer() {
    if (!_studyTimerState) {
        clearInterval(_studyTimerInterval);
        _studyTimerInterval = null;
        updateStudyTimerUI();
        return;
    }
    if (_studyTimerState.status === 'running' && getStudyTimerRemainingSeconds() <= 0) {
        finishStudyTimer(true);
        return;
    }
    updateStudyTimerUI();
}

function updateStudyTimerUI() {
    var remaining = getStudyTimerRemainingSeconds();
    var isActive = !!_studyTimerState;
    var isPaused = isActive && _studyTimerState.status === 'paused';
    var navbarTimer = document.getElementById('navbar-study-timer');
    if (navbarTimer) {
        navbarTimer.innerHTML = isActive
            ? '<button class="study-timer-pill active ' + (isPaused ? 'paused' : '') + '" onclick="openStudyTimer()"><span><i class="fas ' + (isPaused ? 'fa-pause' : 'fa-hourglass-half') + '"></i> ' + escapeHtml(isPaused ? 'Pausado' : (_studyTimerState.subject || 'Foco')) + ' · ' + formatTimerSeconds(remaining) + '</span><em style="width:' + getStudyTimerProgressPercent().toFixed(1) + '%"></em></button>'
            : '<button class="btn btn-accent btn-sm" onclick="openStudyTimer()" style="display:flex;align-items:center;gap:8px"><i class="fas fa-hourglass-start"></i> Estudar Agora</button>';
    }
    var modal = document.getElementById('study-timer-modal');
    if (!modal) return;
    var hasCompletion = !!_studyTimerLastCompleted && !isActive;
    document.getElementById('timer-subject-select').style.display = isActive || hasCompletion ? 'none' : 'block';
    document.getElementById('timer-active-panel').style.display = isActive ? 'block' : 'none';
    document.getElementById('timer-complete-panel').style.display = hasCompletion ? 'block' : 'none';
    document.getElementById('timer-start-btn').style.display = (hasCompletion || (isActive && !isPaused)) ? 'none' : 'inline-flex';
    document.getElementById('timer-pause-btn').style.display = isActive ? 'inline-flex' : 'none';
    document.getElementById('timer-cancel-btn').style.display = isActive ? 'inline-flex' : 'none';
    document.getElementById('timer-start-btn').innerHTML = isPaused ? '<i class="fas fa-play"></i> Retomar' : '<i class="fas fa-play"></i> Começar';
    document.getElementById('timer-pause-btn').innerHTML = isPaused ? '<i class="fas fa-play"></i> Retomar' : '<i class="fas fa-pause"></i> Pausar';
    document.getElementById('timer-display').textContent = formatTimerSeconds(remaining);
    document.getElementById('timer-active-subject').textContent = isActive ? (_studyTimerState.subject || 'Sessão em andamento') : 'Sessão em andamento';
    document.getElementById('timer-progress-fill').style.width = getStudyTimerProgressPercent().toFixed(1) + '%';
    if (_studyTimerLastCompleted) {
        document.getElementById('timer-complete-message').textContent = _studyTimerLastCompleted.durationMinutes + ' min de ' + _studyTimerLastCompleted.subject + ' registrados. Faça uma pausa breve ou comece outro bloco.';
    }
    document.getElementById('timer-baron-img').src = isActive ? '/baron-reading-sm.png' : '/baron-thumbsup-sm.png';
}

function prepareStudyTimerAudio() {
    try {
        var AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!_studyTimerAudioContext && AudioContext) _studyTimerAudioContext = new AudioContext();
        if (_studyTimerAudioContext && _studyTimerAudioContext.state === 'suspended') _studyTimerAudioContext.resume();
    } catch (e) {}
}

function playStudyTimerAlert() {
    try {
        prepareStudyTimerAudio();
        var ctx = _studyTimerAudioContext;
        if (!ctx) return;
        var gain = ctx.createGain();
        gain.gain.value = 0.04;
        gain.connect(ctx.destination);
        [0, 0.18].forEach(function(offset) {
            var osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = 880;
            osc.connect(gain);
            osc.start(ctx.currentTime + offset);
            osc.stop(ctx.currentTime + offset + 0.12);
        });
    } catch (e) {}
}

ensureStudyTimerInterval();
/* Visual theme: keep the new rice-paper interface light in every OS mode. */
document.documentElement.classList.remove('dark');

/* Toast */
function showToast(msg, type) {
    type = type || 'success';
    var icons = { success:'fa-check-circle', error:'fa-exclamation-circle', info:'fa-info-circle' };
    var t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.innerHTML = '<i class="fas ' + (icons[type]||icons.info) + '"></i> ' + escapeHtml(msg);
    document.getElementById('toast-container').appendChild(t);
    setTimeout(function() { t.classList.add('show'); }, 10);
    setTimeout(function() { t.classList.remove('show'); setTimeout(function() { t.remove(); }, 300); }, 2500);
}

/* Confirm Modal */
function showConfirmModal(title, msg, confirmText, cls, onConfirm) {
    var o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = '<div class="modal"><h3>'+escapeHtml(title)+'</h3><p>'+escapeHtml(msg)+'</p><div class="modal-actions"><button class="btn btn-secondary cancel-btn">Cancelar</button><button class="btn '+(cls||'btn-danger')+' confirm-btn">'+escapeHtml(confirmText)+'</button></div></div>';
    o.querySelector('.cancel-btn').addEventListener('click', function() { o.remove(); });
    o.querySelector('.confirm-btn').addEventListener('click', function() { onConfirm(); o.remove(); });
    o.addEventListener('click', function(e) { if (e.target === o) o.remove(); });
    document.body.appendChild(o);
}

/* Form Modal */
function showFormModal(title, fields, submitText, onSubmit) {
    var o = document.createElement('div'); o.className = 'modal-overlay';
    var fh = fields.map(function(f) {
        var ih = '';
        if (f.type === 'textarea') ih = '<textarea id="modal-'+f.name+'" placeholder="'+escapeHtml(f.placeholder||'')+'">'+escapeHtml(f.value||'')+'</textarea>';
        else if (f.type === 'select') { ih = '<select id="modal-'+f.name+'">' + f.options.map(function(op) { return '<option value="'+escapeHtml(op.value)+'"'+(op.value===f.value?' selected':'')+'>'+escapeHtml(op.label)+'</option>'; }).join('') + '</select>'; }
        else ih = '<input type="'+(f.type||'text')+'" id="modal-'+f.name+'" value="'+escapeHtml(f.value||'')+'" placeholder="'+escapeHtml(f.placeholder||'')+'"'+(f.required?' required':'')+'>';
        return '<div class="form-group"><label>'+escapeHtml(f.label)+'</label>'+ih+'</div>';
    }).join('');
    o.innerHTML = '<div class="modal"><h3>'+escapeHtml(title)+'</h3><form id="modal-form">'+fh+'<div class="modal-actions"><button type="button" class="btn btn-secondary cancel-btn">Cancelar</button><button type="submit" class="btn btn-primary">'+escapeHtml(submitText)+'</button></div></form></div>';
    o.querySelector('.cancel-btn').addEventListener('click', function() { o.remove(); });
    o.querySelector('#modal-form').addEventListener('submit', function(e) {
        e.preventDefault();
        var v = {}; fields.forEach(function(f) { v[f.name] = document.getElementById('modal-'+f.name).value; });
        onSubmit(v); o.remove();
    });
    o.addEventListener('click', function(e) { if (e.target === o) o.remove(); });
    document.body.appendChild(o);
}

/* ============================================================
   NAVIGATION
   ============================================================ */
var _navHistory = [];
function navigate(view, params) {
    _navHistory.push({ view: state.view, subjectId: state.selectedSubjectId, lessonId: state.selectedLessonId });
    if (_navHistory.length > 30) _navHistory.shift();
    state.view = view;
    if (params) {
        if (params.subjectId !== undefined) state.selectedSubjectId = params.subjectId;
        if (params.lessonId !== undefined) state.selectedLessonId = params.lessonId;
    }
    render();
    window.scrollTo(0, 0);
}
function goBack() {
    if (_navHistory.length === 0) return;
    var prev = _navHistory.pop();
    state.view = prev.view;
    state.selectedSubjectId = prev.subjectId;
    state.selectedLessonId = prev.lessonId;
    render();
    window.scrollTo(0, 0);
}

/* ============================================================
   NAVBAR
   ============================================================ */
function renderNavbar(links) {
    var initial = state.user ? state.user.name.charAt(0).toUpperCase() : '?';
    var home = state.user && state.user.role === 'admin' ? 'admin-dashboard' : 'student-dashboard';
    var lh = links.map(function(l) { return '<button class="'+(state.view===l.view?'active':'')+'" onclick="navigate(\''+l.view+'\')"><i class="fas '+l.icon+'"></i> <span>'+escapeHtml(l.label)+'</span></button>'; }).join('');
    var timerBtn = (state.user && state.user.role !== 'admin') ? '<span id="navbar-study-timer"></span>' : '';
    setTimeout(updateStudyTimerUI, 0);
    var backBtn = _navHistory.length > 0 ? '<button onclick="goBack()" title="Voltar" style="background:none;border:none;color:var(--text-muted);cursor:pointer;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:all var(--transition);flex-shrink:0" onmouseover="this.style.background=\'var(--surface-hover)\';this.style.color=\'var(--primary)\'" onmouseout="this.style.background=\'none\';this.style.color=\'var(--text-muted)\'"><i class="fas fa-arrow-left"></i></button>' : '';
    return '<nav class="navbar"><div class="navbar-inner"><div style="display:flex;align-items:center;gap:6px;flex-shrink:0"><div class="navbar-brand" onclick="navigate(\''+home+'\')"><div class="logo" style="background:transparent;padding:0;width:32px;height:32px"><img src="/baron-avatar.png" style="width:32px;height:32px;border-radius:50%;object-fit:cover" onerror="this.style.display=\'none\'"></div><span>Barão</span></div>'+backBtn+'</div><div class="navbar-links">'+lh+'</div><div class="navbar-user">'+timerBtn+'<div class="avatar">'+escapeHtml(initial)+'</div><span>'+escapeHtml(state.user?state.user.name:'')+'</span><button class="logout-btn" onclick="handleLogout()" title="Sair"><i class="fas fa-sign-out-alt"></i></button></div></div></nav>';
}
function adminNav() { return [{ view:'admin-dashboard',icon:'fa-th-large',label:'Matérias' },{ view:'admin-users',icon:'fa-users-cog',label:'Usuários' },{ view:'admin-schema',icon:'fa-database',label:'Schema' }]; }
function studentNav() { return [{view:'student-dashboard',icon:'fa-table-cells-large',label:'Matérias'},{view:'student-planner',icon:'fa-calendar-check',label:'Plano de Hoje'},{view:'student-macro-planner',icon:'fa-map',label:'Plano Mestre'},{view:'student-simulado',icon:'fa-pen-to-square',label:'Simulado'},{view:'student-performance',icon:'fa-chart-line',label:'Desempenho'}]; }

/* ============================================================
   VIEW: RESET PASSWORD
   ============================================================ */
function renderResetPassword() {
    return '<div class="login-screen"><div class="login-card"><div class="login-logo" style="background:transparent;padding:0"><img src="/baron-avatar.png" style="width:72px;height:72px;border-radius:50%;object-fit:cover" onerror="this.style.display=\'none\'"></div><h1>Barão</h1><p class="subtitle">Recuperação de Senha</p><div class="login-error" id="reset-error"><i class="fas fa-exclamation-circle"></i><span id="reset-error-msg"></span></div><form id="reset-form"><div class="form-group" style="text-align:left"><label>Seu Usuário</label><input type="text" id="reset-username" placeholder="Digite seu usuário" autocomplete="username" required></div><div class="form-group" style="text-align:left"><label>Nova Senha</label><div class="password-wrapper"><input type="password" id="reset-password" placeholder="Mínimo de 4 caracteres" autocomplete="new-password" required><button type="button" class="password-toggle" id="pw-reset-toggle" tabindex="-1"><i class="fas fa-eye"></i></button></div></div><button type="submit" class="btn btn-primary" id="reset-btn" style="width:100%;justify-content:center;padding:14px"><i class="fas fa-key"></i> Redefinir Senha</button><div style="margin-top:16px;text-align:center"><a href="#" onclick="navigate(\'login\');return false;" style="font-size:.9rem;color:var(--text-muted)">Voltar ao Login</a></div></form></div></div>';
}
function bindResetPassword() {
    var pwT = document.getElementById('pw-reset-toggle');
    if (pwT) pwT.addEventListener('click', function() { var i=document.getElementById('reset-password'),ic=this.querySelector('i'); if(i.type==='password'){i.type='text';ic.className='fas fa-eye-slash';}else{i.type='password';ic.className='fas fa-eye';} });
    var form = document.getElementById('reset-form');
    if (form) form.addEventListener('submit', function(e) {
        e.preventDefault();
        var u=document.getElementById('reset-username').value.trim(), p=document.getElementById('reset-password').value;
        if (!u||!p) { showResetError('Preencha todos os campos.'); return; }
        var btn=document.getElementById('reset-btn'); btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Atualizando...';
        API.resetPassword(state.resetToken, u, p).then(function() {
            showToast('Senha redefinida com sucesso!', 'success');
            // Remove the reset parameter from the URL cleanly
            if(window.history && window.history.replaceState) {
                var cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                window.history.replaceState({path:cleanUrl}, '', cleanUrl);
            }
            state.resetToken = null;
            navigate('login');
        }).catch(function(err) {
            showResetError(err.message); btn.disabled=false; btn.innerHTML='<i class="fas fa-key"></i> Redefinir Senha';
        });
    });
}
function showResetError(msg) { var e=document.getElementById('reset-error'),m=document.getElementById('reset-error-msg'); if(e&&m){m.textContent=msg;e.classList.add('show');setTimeout(function(){e.classList.remove('show');},4000);} }

/* ============================================================
   VIEW: LOGIN
   ============================================================ */
function renderLogin() {
    return '<div class="login-screen"><div class="login-card"><div class="login-logo" style="background:transparent;padding:0"><img src="/baron-avatar.png" style="width:72px;height:72px;border-radius:50%;object-fit:cover" onerror="this.style.display=\'none\'"></div><h1>Barão</h1><p class="subtitle">Seu Coach para o CACD</p><div class="login-error" id="login-error"><i class="fas fa-exclamation-circle"></i><span id="login-error-msg"></span></div><form id="login-form"><div class="form-group" style="text-align:left"><label>Usuário</label><input type="text" id="login-username" placeholder="Digite seu usuário" autocomplete="username" required></div><div class="form-group" style="text-align:left"><label>Senha</label><div class="password-wrapper"><input type="password" id="login-password" placeholder="Digite sua senha" autocomplete="current-password" required><button type="button" class="password-toggle" id="pw-toggle" tabindex="-1"><i class="fas fa-eye"></i></button></div></div><button type="submit" class="btn btn-primary" id="login-btn" style="width:100%;justify-content:center;padding:14px"><i class="fas fa-sign-in-alt"></i> Entrar</button><div style="margin-top: 16px; font-size: 0.9rem;"><a href="mailto:rafaelordanini@gmail.com?subject=Recupera%C3%A7%C3%A3o%20de%20Senha%20-%20EduFlow" style="color: var(--text-muted); text-decoration: underline;">Esqueceu a senha?</a></div></form></div></div>';
}
function bindLogin() {
    var pwT = document.getElementById('pw-toggle');
    if (pwT) pwT.addEventListener('click', function() { var i=document.getElementById('login-password'),ic=this.querySelector('i'); if(i.type==='password'){i.type='text';ic.className='fas fa-eye-slash';}else{i.type='password';ic.className='fas fa-eye';} });
    var form = document.getElementById('login-form');
    if (form) form.addEventListener('submit', function(e) {
        e.preventDefault();
        var u=document.getElementById('login-username').value.trim(), p=document.getElementById('login-password').value;
        if (!u||!p) { showLoginError('Preencha todos os campos.'); return; }
        var btn=document.getElementById('login-btn'); btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Entrando...';
        API.login(u, p).then(function(data) {
            API.setToken(data.token);
            state.user = data.user;
            navigate(data.user.role==='admin'?'admin-dashboard':'student-dashboard');
            showToast('Bem-vindo, '+data.user.name+'!','info');
        }).catch(function(err) {
            showLoginError(err.message); btn.disabled=false; btn.innerHTML='<i class="fas fa-sign-in-alt"></i> Entrar';
        });
    });
}
function showLoginError(msg) { var e=document.getElementById('login-error'),m=document.getElementById('login-error-msg'); if(e&&m){m.textContent=msg;e.classList.add('show');setTimeout(function(){e.classList.remove('show');},4000);} }

/* ============================================================
   VIEW: ADMIN DASHBOARD
   ============================================================ */
function renderAdminDashboard() {
    var app = document.getElementById('app');
    app.innerHTML = renderNavbar(adminNav()) + '<div class="container"><div class="page-content"><div class="page-header"><h1>Matérias</h1><button class="btn btn-primary" onclick="handleAddSubject()"><i class="fas fa-plus"></i> Nova Matéria</button></div><div class="loading-spinner" id="subjects-area"><i class="fas fa-spinner"></i> Carregando...</div></div></div>';
    API.getSubjects().then(function(subjects) {
        var area = document.getElementById('subjects-area');
        if (!area) return;
        area.className = '';
        if (subjects.length === 0) { area.innerHTML = '<div class="empty-state"><i class="fas fa-book-open"></i><h3>Nenhuma matéria cadastrada</h3><p>Crie sua primeira matéria para começar.</p></div>'; return; }
        // Fetch lesson counts
        var promises = subjects.map(function(s) { return API.getLessons(s.id).then(function(l) { s._lessonCount = l.length; }); });
        Promise.all(promises).then(function() {
            var cards = subjects.map(function(s) {
                var lc = s._lessonCount || 0;
                return '<div class="card"><div class="card-header"><div><h3>'+escapeHtml(s.name)+'</h3></div><div class="card-actions"><button onclick="handleEditSubject('+s.id+',\''+escapeHtml(s.name).replace(/'/g,"\\'")+'\',\''+escapeHtml(s.description||'').replace(/'/g,"\\'")+'\')"><i class="fas fa-pen"></i></button><button class="danger" onclick="handleDeleteSubject('+s.id+',\''+escapeHtml(s.name).replace(/'/g,"\\'")+'\')" title="Excluir"><i class="fas fa-trash"></i></button></div></div><p>'+escapeHtml(s.description)+'</p><div class="card-meta"><span><i class="fas fa-play-circle"></i> '+lc+' aula'+(lc!==1?'s':'')+'</span></div><div style="margin-top:14px"><button class="btn btn-sm btn-secondary" onclick="navigate(\'admin-subject\',{subjectId:'+s.id+'})"><i class="fas fa-list"></i> Gerenciar Aulas</button></div></div>';
            }).join('');
            area.innerHTML = '<div class="grid">' + cards + '</div>';
        });
    }).catch(function(err) { showToast(err.message, 'error'); });
}

/* ============================================================
   VIEW: ADMIN SUBJECT
   ============================================================ */
function renderAdminSubject() {
    var sid = state.selectedSubjectId;
    var app = document.getElementById('app');
    app.innerHTML = renderNavbar(adminNav()) + '<div class="container"><div class="page-content"><div class="loading-spinner"><i class="fas fa-spinner"></i> Carregando...</div></div></div>';
    Promise.all([API.getSubjects(), API.getLessons(sid)]).then(function(results) {
        var subjects = results[0], lessons = results[1];
        var subject = subjects.find(function(s) { return s.id === sid; });
        if (!subject) { navigate('admin-dashboard'); return; }
        var lessonsHtml = lessons.length > 0 ? '<div class="lesson-list">' + lessons.map(function(l) {
            var us = l.embed_url ? '<span style="color:var(--success);font-size:.75rem"><i class="fas fa-check"></i> embed</span>' : '<span style="color:var(--text-muted);font-size:.75rem">sem link</span>';
            return '<div class="lesson-item"><div class="order-num">'+l.order_index+'</div><div class="lesson-info"><div class="lesson-title">'+escapeHtml(l.title)+'</div><div class="lesson-meta">'+l.duration_minutes+' min &middot; '+us+'</div></div><div class="lesson-actions">'+(l.order_index>1?'<button onclick="handleReorderLesson('+l.id+',-1)"><i class="fas fa-chevron-up"></i></button>':'')+(l.order_index<lessons.length?'<button onclick="handleReorderLesson('+l.id+',1)"><i class="fas fa-chevron-down"></i></button>':'')+'<button onclick="handleEditLessonApi('+l.id+')"><i class="fas fa-pen"></i></button><button class="danger" onclick="handleDeleteLessonApi('+l.id+',\''+escapeHtml(l.title).replace(/'/g,"\\'")+'\')"><i class="fas fa-trash"></i></button></div></div>';
        }).join('') + '</div>' : '<div class="empty-state" style="padding:40px"><i class="fas fa-video"></i><h3>Nenhuma aula cadastrada</h3></div>';

        app.innerHTML = renderNavbar(adminNav()) + '<div class="container"><div class="page-content">' +
            '<div class="breadcrumb"><a onclick="navigate(\'admin-dashboard\')">Matérias</a><span class="sep"><i class="fas fa-chevron-right"></i></span><span>'+escapeHtml(subject.name)+'</span></div>' +
            '<div class="page-header"><h1>'+escapeHtml(subject.name)+'</h1></div>' +
            '<div class="form-card"><h3><i class="fas fa-plus-circle" style="color:var(--primary);margin-right:6px"></i>Adicionar Aula</h3><form id="add-lesson-form"><div class="form-group"><label>Título da Aula</label><input type="text" id="new-lesson-title" placeholder="Ex: Introdução ao tema" required></div><div class="form-row"><div class="form-group"><label>Link do Google Drive</label><input type="url" id="new-lesson-url" placeholder="https://drive.google.com/file/d/.../view"><div id="url-status" class="url-status"></div></div><div class="form-group" style="max-width:140px"><label>Duração (min)</label><input type="number" id="new-lesson-duration" min="1" value="15" required></div></div><button type="submit" class="btn btn-primary" id="add-lesson-btn"><i class="fas fa-plus"></i> Adicionar Aula</button></form></div>' +
            '<h2 style="font-size:1.2rem;margin-bottom:16px"><i class="fas fa-list-ol" style="color:var(--accent);margin-right:8px;font-size:1rem"></i>Aulas ('+lessons.length+')</h2>' + lessonsHtml +
        '</div></div>';
        bindAdminSubject();
    }).catch(function(err) { showToast(err.message, 'error'); });
}

function bindAdminSubject() {
    var ui = document.getElementById('new-lesson-url');
    if (ui) ui.addEventListener('input', function() {
        var s=document.getElementById('url-status'),u=this.value.trim();
        if(!u){s.innerHTML='';return;}
        var m=u.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)||u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if(m){s.innerHTML='<i class="fas fa-check-circle"></i> URL válida';s.className='url-status valid';}
        else{s.innerHTML='<i class="fas fa-times-circle"></i> URL não reconhecida';s.className='url-status invalid';}
    });
    var f = document.getElementById('add-lesson-form');
    if (f) f.addEventListener('submit', function(e) {
        e.preventDefault();
        var t=document.getElementById('new-lesson-title').value.trim(), u=document.getElementById('new-lesson-url').value.trim(), d=parseInt(document.getElementById('new-lesson-duration').value,10)||15;
        if(!t){showToast('Preencha o título','error');return;}
        var btn=document.getElementById('add-lesson-btn'); btn.disabled=true;
        API.createLesson({ subject_id:state.selectedSubjectId, title:t, drive_url:u, duration_minutes:d }).then(function() {
            showToast('Aula adicionada!'); render();
        }).catch(function(err) { showToast(err.message,'error'); btn.disabled=false; });
    });
}

/* ============================================================
   VIEW: ADMIN USERS
   ============================================================ */
function renderAdminUsers() {
    var app = document.getElementById('app');
    app.innerHTML = renderNavbar(adminNav()) + '<div class="container"><div class="page-content"><div class="page-header"><h1>Gerenciar Usuários</h1><button class="btn btn-primary" onclick="handleAddUser()"><i class="fas fa-user-plus"></i> Novo Usuário</button></div><div class="loading-spinner" id="users-area"><i class="fas fa-spinner"></i> Carregando...</div></div></div>';
    API.getUsers().then(function(users) {
        var area = document.getElementById('users-area');
        if (!area) return;
        area.className = '';
        var ac = users.filter(function(u){return u.role==='admin';}).length;
        var sc = users.filter(function(u){return u.role==='student';}).length;
        var rows = users.map(function(u) {
            var self = state.user && state.user.id === u.id;
            return '<tr><td><strong>'+escapeHtml(u.name)+'</strong>'+(self?' <span style="font-size:.75rem;color:var(--primary)">(você)</span>':'')+'</td><td class="mono">'+escapeHtml(u.username)+'</td><td><span class="role-badge '+u.role+'">'+(u.role==='admin'?'Admin':'Aluno')+'</span></td><td class="actions-cell"><button onclick="handleEditUserApi('+u.id+')"><i class="fas fa-pen"></i></button>'+(self?'':'<button class="danger" onclick="handleDeleteUserApi('+u.id+',\''+escapeHtml(u.name).replace(/'/g,"\\'")+'\')"><i class="fas fa-trash"></i></button>')+'</td></tr>';
        }).join('');
        area.innerHTML = '<div style="display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap"><div class="card" style="flex:1;min-width:140px;padding:18px;cursor:default"><div class="card-meta" style="margin-bottom:4px"><i class="fas fa-users" style="color:var(--primary)"></i> Total</div><div style="font-size:1.5rem;font-weight:700;font-family:Fraunces,serif">'+users.length+'</div></div><div class="card" style="flex:1;min-width:140px;padding:18px;cursor:default"><div class="card-meta" style="margin-bottom:4px"><i class="fas fa-user-shield" style="color:var(--accent)"></i> Admins</div><div style="font-size:1.5rem;font-weight:700;font-family:Fraunces,serif">'+ac+'</div></div><div class="card" style="flex:1;min-width:140px;padding:18px;cursor:default"><div class="card-meta" style="margin-bottom:4px"><i class="fas fa-user-graduate" style="color:var(--primary)"></i> Alunos</div><div style="font-size:1.5rem;font-weight:700;font-family:Fraunces,serif">'+sc+'</div></div></div><div class="form-card" style="padding:0;overflow:auto"><table class="user-table"><thead><tr><th>Nome</th><th>Usuário</th><th>Perfil</th><th>Ações</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
    }).catch(function(err) { showToast(err.message, 'error'); });
}

/* ============================================================
   VIEW: ADMIN SCHEMA (static — same as before)
   ============================================================ */
function renderAdminSchema() {
    var app = document.getElementById('app');
    app.innerHTML = renderNavbar(adminNav()) + '<div class="container"><div class="page-content"><div class="page-header"><h1><i class="fas fa-database" style="color:var(--accent);font-size:1.4rem;margin-right:8px"></i>Schema do Banco</h1></div><p style="color:var(--text-secondary);margin-bottom:24px">As tabelas abaixo estão no Supabase (PostgreSQL). Veja o arquivo <code style="background:var(--code-bg);padding:2px 6px;border-radius:4px;font-size:.85rem">sql/schema.sql</code> no projeto.</p><div style="background:var(--code-bg);border:1px solid var(--border);border-radius:var(--radius-md);padding:20px;font-family:monospace;font-size:.84rem;line-height:1.7;overflow-x:auto;white-space:pre;color:var(--text)">-- users (id, username, password_hash, name, role, created_at)\n-- subjects (id, name, description, created_at, updated_at)\n-- lessons (id, subject_id → subjects, title, drive_url, embed_url, duration_minutes, order_index, created_at)\n-- progress (id, user_id → users, lesson_id → lessons, current_time_seconds, completed, last_accessed)\n--   UNIQUE(user_id, lesson_id)</div></div></div>';
}

/* ============================================================
   VIEW: STUDENT PLANNER
   ============================================================ */
function renderStudentPlanner() {
    var app = document.getElementById('app');
    var nav = renderNavbar(studentNav());
    app.innerHTML = nav + '<div class="container"><div class="page-content">' +
        zenTitle('fa-calendar-check', 'Plano de Hoje', 'Seu caminho diário rumo à aprovação. Foco, constância e estratégia.') +
        '<div id="master-week-panel" style="margin-bottom:20px"><div class="loading-spinner" style="font-size:.85rem"><i class="fas fa-spinner fa-spin"></i> Verificando Plano Mestre…</div></div>' +
        '<div class="planner-form" id="planner-form">' +
          '<div class="planner-controls">' +
            '<div><div style="font-family:Cormorant Garamond,serif;font-size:1.35rem;font-weight:700;color:var(--text-strong);margin-bottom:14px">Quantas horas você tem disponíveis hoje?</div>' +
              '<div class="hours-selector">' +
                '<button class="hours-btn" onclick="selectHours(this,1)">1h</button><button class="hours-btn" onclick="selectHours(this,2)">2h</button><button class="hours-btn" onclick="selectHours(this,3)">3h</button><button class="hours-btn" onclick="selectHours(this,4)">4h</button><button class="hours-btn" onclick="selectHours(this,5)">5h</button><button class="hours-btn" onclick="selectHours(this,6)">6h</button><button class="hours-btn" onclick="selectHours(this,8)">8h</button>' +
              '</div><input type="hidden" id="planner-hours" value="3"></div>' +
            '<div><label style="font-size:.9rem;color:var(--text-strong);font-weight:600">Observações <span style="color:var(--text-muted);font-weight:500">(opcional)</span></label>' +
              '<textarea id="planner-obs" placeholder="Ex.: Preciso revisar gramática, reler resumos, etc." style="margin-top:8px;min-height:78px"></textarea></div>' +
          '</div>' +
          '<button class="btn btn-primary" style="margin-top:20px;width:100%;justify-content:center;padding:14px" onclick="gerarPlano()"><i class="fas fa-magic"></i> Gerar Plano com IA</button>' +
        '</div>' +
        '<div id="plan-output" class="plan-output" style="display:none"></div>' +
        '<div class="history-section" id="history-section" style="display:none">' +
          '<h2><i class="fas fa-history"></i> Histórico de Planos</h2>' +
          '<div id="history-list"><div class="loading-spinner"><i class="fas fa-spinner"></i> Carregando histórico...</div></div>' +
        '</div>' +
        '</div></div>';
    // pre-select 3h
    var btns = document.querySelectorAll('.hours-btn');
    btns.forEach(function(b) { if (b.textContent === '3h') b.classList.add('active'); });
    // Load Plano Mestre current week + plan history in parallel
    Promise.all([
        API.request('GET', '/api/generate-macro-plan').catch(function(){ return null; }),
        API.getPlansHistory().catch(function(){ return []; })
    ]).then(function(results) {
        renderMasterWeekPanel(results[0]);
        renderPlansHistory(results[1]);
    });
}


function getSequentialMacroStudyDate(planJson, requestedDate) {
    var target = requestedDate || new Date().toISOString().split('T')[0];
    var pending = [];
    (planJson && planJson.semanas || []).forEach(function(week) {
        (week.materias || []).forEach(function(item) {
            if (item && item.tipo === 'estudo' && !item.done && item.data) pending.push(item);
        });
    });
    pending.sort(function(a, b) { return String(a.data).localeCompare(String(b.data)) || Number(a.dia || 0) - Number(b.dia || 0); });
    return pending.length && pending[0].data <= target ? pending[0].data : target;
}

function atualizarDatasMacroPlan() {
    var btn = document.getElementById('macro-reschedule-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Atualizando datas…'; }
    API.request('PUT', '/api/generate-macro-plan', { action: 'reschedule_from_pending' }).then(function(resp) {
        showToast('Datas do Plano Mestre atualizadas a partir de hoje.', 'success');
        var out = document.querySelector('#macro-main-area .macro-output') || document.getElementById('macro-output');
        if (resp && resp.plan_json && out) renderMacroPlan(resp.plan_json, out);
        renderStudentMacroPlan();
    }).catch(function(err) {
        showToast(err.message || 'Erro ao atualizar datas do Plano Mestre', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-calendar-day"></i> Atualizar datas atrasadas'; }
    });
}

function renderMasterWeekPanel(macro) {
    var panel = document.getElementById('master-week-panel');
    if (!panel) return;
    if (!macro || !macro.plan_json) {
        panel.innerHTML = '<div style="background:var(--surface-hover);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px 16px;font-size:.85rem;color:var(--text-muted)">' +
            '<i class="fas fa-road" style="margin-right:6px"></i> Você ainda não tem um Plano Mestre. ' +
            '<a onclick="navigate(\'student-macro-planner\')" style="cursor:pointer;color:var(--primary);font-weight:600">Criar agora →</a>' +
        '</div>';
        return;
    }
    var today = new Date().toISOString().split('T')[0];
    var studyDate = getSequentialMacroStudyDate(macro.plan_json, today);
    var isSequentialCatchUp = studyDate !== today;
    var semanas = macro.plan_json.semanas || [];
    var currentWeek = semanas.find(function(s) { return s.dataInicio && s.dataFim && studyDate >= s.dataInicio && studyDate <= s.dataFim; });
    if (!currentWeek) {
        // Find the next upcoming week
        currentWeek = semanas.find(function(s) { return s.dataInicio && today < s.dataInicio; });
    }
    if (!currentWeek) { panel.innerHTML = ''; return; }

    var materias = currentWeek.materias || [];
    var todayLessons = materias.filter(function(m) { return m.data === studyDate; });
    var isTodayInWeek = currentWeek.dataInicio && currentWeek.dataFim && studyDate >= currentWeek.dataInicio && studyDate <= currentWeek.dataFim;
    var showingToday = macro.plan_json.macro_plan_version >= 3 && isTodayInWeek;
    var isRestToday = (currentWeek.datasDescanso || []).indexOf(studyDate) !== -1;
    if (showingToday) materias = todayLessons;
    var noTasksToday = showingToday && !isRestToday && materias.length === 0;
    var pendingStudy = materias.filter(function(m) { return m.tipo === 'estudo' && !m.done; });
    var pendingReview = materias.filter(function(m) { return m.tipo === 'revisao' && !m.done; });
    var doneCount = materias.filter(function(m) { return m.done; }).length;

    var itemsHtml = materias.map(function(m) {
        var isRev = m.tipo === 'revisao';
        var isDone = !!m.done;
        var checkClass = isDone ? (isRev ? 'checked-rev' : 'checked') : '';
        var checkIcon = isDone ? '<i class="fas fa-check"></i>' : '';
        var mId = m.id || '';
        var scheduled = m.data ? '<div style="font-size:.78rem;color:var(--primary);margin-top:4px"><i class="fas fa-calendar-day" style="margin-right:5px"></i>Dia ' + (m.dia || '') + ' · ' + new Date(m.data + 'T12:00:00').toLocaleDateString('pt-BR') + '</div>' : '';
        var actBtns = '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">' +
            '<button class="macro-link-btn lesson" style="font-size:.72rem;padding:3px 8px" onclick="abrirAulasPlano(' + _jsNull(m.subject_id) + ',' + _jsNull(m.lesson_id) + ')">' +
                '<i class="fas fa-play-circle"></i> Ver aulas</button>' +
            '<button class="macro-link-btn exercise" style="font-size:.72rem;padding:3px 8px" onclick="abrirRevisaoPlano(' + _js(m.nome || '') + ')">' +
                '<i class="fas fa-question-circle"></i> ' + (isRev ? 'Fazer exercícios' : 'Praticar questões') + '</button>' +
        '</div>';
        return '<div id="mitem-' + escapeHtml(mId) + '" class="card planner-task tipo-' + (isRev ? 'revisao' : 'estudo') + (isDone ? ' done-item' : '') + '">' +
            '<div class="macro-check ' + checkClass + '" onclick="toggleMacraItem(' + _js(mId) + ',' + !isDone + ')" title="Marcar como ' + (isDone ? 'pendente' : 'concluído') + '">' + checkIcon + '</div>' +
            '<div style="min-width:0">' +
              '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:4px"><span class="macro-badge ' + (isRev ? 'revisao' : 'estudo') + '">' + (isRev ? 'Revisão' : 'Estudo') + '</span><h3 style="font-size:1.35rem;margin:0' + (isDone ? ';text-decoration:line-through;color:var(--text-muted)' : '') + '">' + escapeHtml(m.nome) + '</h3></div>' +
              '<div style="font-size:.92rem;color:var(--text-secondary)">' + escapeHtml(m.topico || '') + '</div>' + scheduled +
            '</div>' +
            '<div class="planner-actions">' + (!isDone ? actBtns : '') + '</div>' +
            '<button class="btn btn-secondary btn-sm" style="width:40px;height:40px;padding:0;justify-content:center" title="Expandir"><i class="fas fa-chevron-down"></i></button>' +
        '</div>';
    }).join('');

    var pct = materias.length > 0 ? Math.round(doneCount / materias.length * 100) : 0;
    var provaDateValue = macro.plan_json.modoPlanejamento === 'data_prova' ? macro.plan_json.dataProva : null;
    var provaDate = provaDateValue ? new Date(provaDateValue + 'T12:00:00') : null;
    var daysLeft = provaDate ? Math.max(0, Math.ceil((provaDate - new Date()) / 86400000)) : null;

    panel.innerHTML =
        '<div class="card" style="margin-bottom:20px;padding:26px 28px">' +
          '<div style="display:grid;grid-template-columns:1fr auto;align-items:center;gap:22px">' +
            '<div style="display:flex;align-items:center;gap:18px">' +
              '<div class="subject-icon"><i class="fas fa-calendar-plus"></i></div><div>' +
              '<h2 style="font-size:1.55rem;margin:0">Plano Mestre — ' + (isRestToday ? 'Descanso de Hoje' : (showingToday ? (isSequentialCatchUp ? 'Próxima etapa pendente' : 'Tarefas de Hoje') : 'Semana ' + (currentWeek.semana || ''))) + '</h2>' +
              '<div style="font-size:.9rem;color:var(--text-secondary);margin-top:4px">' +
                (currentWeek.dataInicio ? escapeHtml(currentWeek.dataInicio) + ' a ' + escapeHtml(currentWeek.dataFim) : '') +
                (isSequentialCatchUp ? ' · retomando ' + new Date(studyDate + 'T12:00:00').toLocaleDateString('pt-BR') : '') +
                (daysLeft !== null ? ' · ' + daysLeft + ' dias para a prova' : '') +
              '</div>' +
            '</div></div>' +
            '<div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap"><div><div style="font-size:1.35rem;font-weight:800;color:var(--primary)">' + doneCount + '/' + materias.length + '</div><div style="font-size:.82rem;color:var(--text-secondary)">concluídos</div></div><div style="width:220px;max-width:40vw"><div class="card-progress-bar"><div class="fill" style="width:' + pct + '%"></div></div><div style="font-size:.78rem;color:var(--text-muted);margin-top:4px;text-align:right">' + pct + '%</div></div><a onclick="navigate(\'student-macro-planner\')" style="cursor:pointer;color:var(--primary);font-weight:700">Ver plano completo <i class="fas fa-arrow-right"></i></a></div>' +
          '</div>' +
        '</div>' +
          '<div style="display:flex;flex-direction:column;gap:10px">' +
            itemsHtml +
            (isRestToday ? '<div style="padding:16px 0;font-size:.9rem;color:var(--primary);font-weight:600"><i class="fas fa-mug-hot"></i> Dia reservado para descanso. Não há aulas nem revisões agendadas.</div>' : (noTasksToday ? '<div style="padding:16px 0;font-size:.9rem;color:var(--text-secondary);font-weight:600"><i class="fas fa-calendar-check"></i> Nenhuma tarefa agendada para hoje.</div>' : (pendingStudy.length === 0 && pendingReview.length === 0 ? '<div style="padding:12px 0;font-size:.85rem;color:var(--success);font-weight:600"><i class="fas fa-check-circle"></i> Tarefas concluídas! Excelente trabalho.</div>' : ''))) +
          '</div>' +
          '<div style="padding:18px 10px;font-size:.9rem;color:var(--text-secondary)">' +
            '<i class="fas fa-magic" style="color:var(--accent);margin-right:5px"></i>' +
            (isSequentialCatchUp ? 'Há estudo pendente em data anterior; o Plano de Hoje seguirá esta etapa antes de avançar.' : (isRestToday ? 'O Plano Mestre reservou hoje para descanso.' : (noTasksToday ? 'O Plano Mestre não possui tarefas para esta data.' : 'O plano de hoje será gerado levando em conta os itens pendentes desta data.'))) +
          '</div>';
}

function renderPlansHistory(plans) {
        var section = document.getElementById('history-section');
        var list = document.getElementById('history-list');
        if (!section || !list) return;
        if (!plans || plans.length === 0) { section.style.display = 'none'; return; }
        section.style.display = 'block';
        // Check if today's plan already exists and show it
        var today = new Date().toISOString().split('T')[0];
        var todayPlan = plans.find(function(p) { return p.plan_date === today; });
        if (todayPlan) {
            var out = document.getElementById('plan-output');
            if (out && out.style.display === 'none') {
                out.style.display = 'block';
                renderPlano(todayPlan.plan_json);
            }
        }
        list.innerHTML = plans.map(function(p, idx) {
            var dateStr = p.plan_date ? new Date(p.plan_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
            var blocos = (p.plan_json && p.plan_json.blocos) ? p.plan_json.blocos.length + ' blocos' : '';
            return '<div class="history-card" onclick="toggleHistoryCard(this,' + idx + ')">' +
                '<div class="history-card-header">' +
                  '<div><div class="history-card-date"><i class="fas fa-calendar-check" style="color:var(--primary);margin-right:6px"></i>' + escapeHtml(dateStr) + '</div>' +
                  '<div class="history-card-meta">' + escapeHtml(p.hours_available + 'h disponíveis') + (p.focus_subjects ? ' · ' + escapeHtml(p.focus_subjects) : '') + (blocos ? ' · ' + blocos : '') + '</div></div>' +
                  '<i class="fas fa-chevron-down" style="color:var(--text-muted);transition:transform .2s ease"></i>' +
                '</div>' +
                '<div class="history-card-body" id="hcb-' + idx + '">' +
                  renderPlanoInline(p.plan_json) +
                '</div>' +
            '</div>';
        }).join('');
}

function loadPlansHistory() {
    API.getPlansHistory().then(renderPlansHistory).catch(function() { /* silently ignore */ });
}

function toggleHistoryCard(card, idx) {
    var body = document.getElementById('hcb-' + idx);
    var icon = card.querySelector('.fa-chevron-down,.fa-chevron-up');
    if (!body) return;
    var isOpen = body.classList.contains('open');
    body.classList.toggle('open', !isOpen);
    if (icon) { icon.className = isOpen ? 'fas fa-chevron-down' : 'fas fa-chevron-up'; icon.style.transform = isOpen ? '' : 'rotate(180deg)'; }
}

function renderPlanoInline(plan) {
    if (!plan) return '<p style="color:var(--text-muted);font-size:.88rem">Plano sem dados.</p>';
    var recTag = { 'Alta': 'tag-alta', 'Média': 'tag-media', 'Baixa': 'tag-baixa' };
    var blocosHtml = (plan.blocos || []).map(function(b) {
        var tags = '';
        if (b.recorrencia) tags += '<span class="tag ' + (recTag[b.recorrencia] || '') + '">' + b.recorrencia + '</span>';
        if (b.materia) tags += '<span class="tag tag-mat">' + escapeHtml(b.materia) + '</span>';
        return '<div class="plan-block">' +
            '<div class="plan-block-time"><i class="fas fa-clock"></i> ' + escapeHtml(b.horario || '') + '</div>' +
            '<div class="plan-block-body"><div style="font-weight:600;font-size:.9rem">' + escapeHtml(b.titulo || '') + '</div>' +
            (b.descricao ? '<div style="font-size:.82rem;color:var(--text-secondary);margin-top:4px">' + escapeHtml(b.descricao) + '</div>' : '') +
            (tags ? '<div class="plan-block-tags" style="margin-top:6px">' + tags + '</div>' : '') +
            '</div></div>';
    }).join('');
    return '<div class="plan-blocks" style="margin-bottom:0">' + blocosHtml + '</div>' +
        (plan.dicaDoDia ? '<div class="plan-dica" style="margin-top:10px"><i class="fas fa-lightbulb"></i> ' + escapeHtml(plan.dicaDoDia) + '</div>' : '');
}

function selectHours(btn, h) {
    document.querySelectorAll('.hours-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    document.getElementById('planner-hours').value = h;
}

function gerarPlano() {
    var hours = parseFloat(document.getElementById('planner-hours').value) || 3;
    var obs = (document.getElementById('planner-obs').value || '').trim();
    var out = document.getElementById('plan-output');
    out.style.display = 'block';
    out.innerHTML = '<div class="plan-loading"><img src="/baron-reading-sm.png" style="width:56px;height:56px;border-radius:50%;animation:pulse 1.5s ease-in-out infinite" onerror="this.style.display=\'none\'"><p>O Barão está elaborando seu plano personalizado…</p></div>';
    baronFloatPose('reading', 8000);
    API.request('POST', '/api/generate-plan', { horasDisponiveis: hours, observacoes: obs }).then(function(plan) {
        renderPlano(plan);
        loadPlansHistory();
        if (plan._masterWeek) renderMasterWeekPanel({ plan_json: { semanas: [plan._masterWeek] } });
    }).catch(function(err) {
        out.innerHTML = '<div style="color:var(--danger);padding:20px;text-align:center"><i class="fas fa-exclamation-triangle"></i> ' + escapeHtml(err.message) + '</div>';
    });
}


function formatPlanPause(pause) {
    if (pause == null) return '';
    if (typeof pause === 'string' || typeof pause === 'number') return String(pause);
    if (typeof pause !== 'object') return String(pause);

    var parts = [];
    if (pause.horario) parts.push(pause.horario);
    if (pause.tipo) parts.push(pause.tipo);
    if (pause.duracaoMin) parts.push(pause.duracaoMin + 'min');
    if (pause.descricao) parts.push(pause.descricao);
    return parts.length ? parts.join(' — ') : '';
}

function renderPlano(plan) {
    var out = document.getElementById('plan-output');
    var recTag = { 'Alta': 'tag-alta', 'Média': 'tag-media', 'Baixa': 'tag-baixa' };
    var blocosHtml = (plan.blocos || []).map(function(b) {
        var tags = '';
        if (b.recorrencia) tags += '<span class="tag ' + (recTag[b.recorrencia] || '') + '">' + b.recorrencia + '</span>';
        if (b.materia) tags += '<span class="tag tag-mat">' + escapeHtml(b.materia) + '</span>';
        if (b.tipo) tags += '<span class="tag tag-tipo">' + escapeHtml(b.tipo) + '</span>';
        return '<div class="plan-block">' +
            '<div class="plan-block-time"><i class="fas fa-clock"></i> ' + escapeHtml(b.horario || '') + ' <span style="font-size:.8rem;color:var(--text-muted)">(' + (b.duracaoMin || '') + 'min)</span></div>' +
            '<div class="plan-block-body">' +
              '<div style="font-weight:600;font-size:1rem;margin-bottom:4px">' + escapeHtml(b.titulo || '') + '</div>' +
              (b.descricao ? '<div style="font-size:.88rem;color:var(--text-secondary);margin-bottom:8px">' + escapeHtml(b.descricao) + '</div>' : '') +
              (tags ? '<div class="plan-block-tags">' + tags + '</div>' : '') +
            '</div>' +
        '</div>';
    }).join('');
    var pausas = (plan.pausas || []).map(formatPlanPause).filter(Boolean);
    var pausasHtml = pausas.length ? '<div style="font-size:.85rem;color:var(--text-muted);margin-top:8px"><i class="fas fa-coffee"></i> Pausas: ' + pausas.map(escapeHtml).join(' · ') + '</div>' : '';
    out.innerHTML =
        '<div class="baron-header">' +
          '<div class="baron-avatar"><img src="/baron-pointing-sm.png" alt="Barão" onerror="this.src=\'/baron-avatar.png\'"></div>' +
          '<div>' +
            '<div style="font-weight:700;font-size:1.05rem">Barão</div>' +
            '<div style="font-size:.88rem;color:var(--text-secondary)">' + escapeHtml(plan.saudacao || '') + '</div>' +
          '</div>' +
        '</div>' +
        (plan.resumoDia ? '<div style="background:var(--primary-light);border-left:4px solid var(--primary);padding:14px 16px;border-radius:0 var(--radius-md) var(--radius-md) 0;margin-bottom:20px;font-size:.93rem;line-height:1.6">' + escapeHtml(plan.resumoDia) + '</div>' : '') +
        '<div class="plan-blocks">' + blocosHtml + '</div>' +
        pausasHtml +
        (plan.dicaDoDia ? '<div class="plan-dica"><i class="fas fa-lightbulb"></i> <strong>Dica do dia:</strong> ' + escapeHtml(plan.dicaDoDia) + '</div>' : '') +
        '<div style="text-align:center;margin-top:20px;font-size:.82rem;color:var(--text-muted)"><i class="fas fa-clock"></i> Total: ' + (plan.totalHorasEstudo || '') + 'h de estudo</div>';
}

/* ============================================================
   VIEW: STUDENT DASHBOARD
   ============================================================ */
function renderStudentDashboard() {
    var app = document.getElementById('app');
    var nav = renderNavbar(studentNav());
    app.innerHTML = nav + '<div class="container"><div class="page-content">' +
        '<div class="subjects-intro">' +
          '<div><h1 style="font-size:3.25rem;margin-bottom:8px">Minhas Matérias</h1><p class="page-subtitle">Acompanhe seu progresso em cada matéria e foque no que realmente importa.</p><div class="decor-line"></div></div>' +
          '<div class="zen-hero" style="min-height:150px;margin-bottom:0;padding:22px 28px;justify-content:flex-end"><div style="text-align:right"><p style="max-width:420px">Disciplina serena, estudo profundo e constância para chegar à prova com clareza.</p></div></div>' +
        '</div>' +
        '<div class="loading-spinner" id="student-area"><i class="fas fa-spinner"></i> Carregando...</div></div></div>';
    Promise.all([API.getSubjects(), API.getProgress()]).then(function(results) {
        var subjects = results[0], progressList = results[1];
        var area = document.getElementById('student-area');
        if (!area) return;
        area.className = '';
        if (subjects.length === 0) { area.innerHTML = '<div class="empty-state"><i class="fas fa-book-open"></i><h3>Nenhuma matéria disponível</h3></div>'; return; }
        // Build progress map and fetch lesson counts
        var pMap = {};
        progressList.forEach(function(p) { pMap[p.lesson_id] = p; });
        var promises = subjects.map(function(s) { return API.getLessons(s.id).then(function(ls) { s._lessons = ls; }); });
        Promise.all(promises).then(function() {
            var cards = subjects.map(function(s) {
                var ls = s._lessons || [], comp = 0;
                ls.forEach(function(l) { if (pMap[l.id] && pMap[l.id].completed) comp++; });
                var pct = ls.length > 0 ? Math.round(comp/ls.length*100) : 0;
                return '<div class="card subject-card" onclick="navigate(\'student-subject\',{subjectId:'+s.id+'})" style="cursor:pointer">' +
                    '<div class="subject-card-top">' +
                      '<div class="subject-icon"><i class="fas ' + subjectIcon(s.name) + '"></i></div>' +
                      '<div style="min-width:0;flex:1"><h3>'+escapeHtml(s.name)+'</h3>' +
                        '<div class="card-meta"><span><i class="fas fa-play-circle"></i> '+ls.length+' aulas</span><span><i class="fas fa-check-circle"></i> '+comp+'/'+ls.length+' concluídas</span></div></div>' +
                      '<span class="card-tag student subject-percent">'+pct+'%</span>' +
                    '</div>' +
                    (s.description ? '<p style="margin:0;color:var(--text-secondary)">'+escapeHtml(s.description)+'</p>' : '') +
                    '<div class="card-progress-bar"><div class="fill" style="width:'+pct+'%"></div></div>' +
                '</div>';
            }).join('');
            area.innerHTML = '<div class="grid">' + cards + '</div>';
        });
    }).catch(function(err) { showToast(err.message, 'error'); });
}

/* ============================================================
   VIEW: STUDENT SUBJECT
   ============================================================ */
function renderStudentSubject() {
    var sid = state.selectedSubjectId;
    var app = document.getElementById('app');
    var nav = renderNavbar([{view:'student-dashboard',icon:'fa-th-large',label:'Matérias'}]);
    app.innerHTML = nav + '<div class="container"><div class="page-content"><div class="loading-spinner"><i class="fas fa-spinner"></i> Carregando...</div></div></div>';
    Promise.all([API.getSubjects(), API.getLessons(sid), API.getProgress()]).then(function(res) {
        var subjects=res[0], lessons=res[1], progressList=res[2];
        var subject = subjects.find(function(s){return s.id===sid;});
        if (!subject) { navigate('student-dashboard'); return; }
        var pMap = {};
        progressList.forEach(function(p) { pMap[p.lesson_id] = p; });
        var lh = lessons.length > 0 ? '<div class="lesson-list">' + lessons.map(function(l) {
            var p = pMap[l.id];
            var sc = p&&p.completed?'complete':(p&&p.current_time_seconds>0?'in-progress':'pending');
            var si = p&&p.completed?'fa-check-circle':(p&&p.current_time_seconds>0?'fa-clock':'fa-circle');
            var sl = p&&p.completed?'Concluída':(p&&p.current_time_seconds>0?formatTime(p.current_time_seconds):'Não iniciada');
            return '<div class="lesson-item clickable" onclick="navigate(\'student-lesson\',{lessonId:'+l.id+'})" style="cursor:pointer"><div class="order-num">'+l.order_index+'</div><div class="lesson-info"><div class="lesson-title">'+escapeHtml(l.title)+'</div><div class="lesson-meta">'+l.duration_minutes+' min &middot; '+sl+'</div></div><div class="status-icon '+sc+'"><i class="fas '+si+'"></i></div></div>';
        }).join('') + '</div>' : '<div class="empty-state" style="padding:40px"><i class="fas fa-video"></i><h3>Nenhuma aula disponível</h3></div>';
        app.innerHTML = nav + '<div class="container"><div class="page-content"><div class="breadcrumb"><a onclick="navigate(\'student-dashboard\')">Matérias</a><span class="sep"><i class="fas fa-chevron-right"></i></span><span>'+escapeHtml(subject.name)+'</span></div><div class="page-header"><h1>'+escapeHtml(subject.name)+'</h1></div>'+lh+'</div></div>';
    }).catch(function(err) { showToast(err.message,'error'); });
}

/* ============================================================
   VIEW: STUDENT LESSON
   ============================================================ */
function renderStudentLesson() {
    var lid = state.selectedLessonId;
    var app = document.getElementById('app');
    var nav = renderNavbar([{view:'student-dashboard',icon:'fa-th-large',label:'Matérias'}]);
    app.innerHTML = nav + '<div class="container"><div class="page-content"><div class="loading-spinner"><i class="fas fa-spinner"></i> Carregando...</div></div></div>';

    Promise.all([API.getSubjects(), API.getProgress(lid)]).then(function(res) {
        var subjects=res[0], progressArr=res[1];
        var prog = progressArr.length > 0 ? progressArr[0] : { current_time_seconds:0, completed:false, last_accessed:null };
        // We need the lesson + all lessons for nav
        // First find which subject this lesson belongs to
        return findLessonAndRender(subjects, lid, prog, nav);
    }).catch(function(err) { showToast(err.message,'error'); });
}

/* Readings per subject */
var LESSON_READINGS = {
    'História do Brasil': {
        fundamental: ['Fausto — História do Brasil caps. 1–11', 'Linhares — História Geral do Brasil caps. 1–10', 'Schwarcz & Starling — Brasil: uma Biografia caps. 1–4', 'Ricupero — A Diplomacia na Construção do Brasil Partes I–V'],
        complementar: ['Doratioto — Maldita Guerra', 'Cervo — História da Política Exterior do Brasil caps. 3,10,13–14', 'Gerson Moura — Autonomia na Dependência', 'Angela Alonso — Flores, Votos e Balas']
    },
    'História Mundial': {
        fundamental: ['Hobsbawm — A Era das Revoluções', 'Hobsbawm — A Era do Capital', 'Hobsbawm — A Era dos Impérios', 'Hobsbawm — A Era dos Extremos'],
        complementar: ['Saraiva — História das Relações Internacionais caps. 1–8', 'Burns — História da Civilização Ocidental v.1–2', 'Gaddis — The Cold War: A New History', 'Kissinger — O Mundo Restaurado']
    },
    'Português': {
        fundamental: ['Cunha & Cintra — Nova Gramática do Português Contemporâneo', 'Bechara — Moderna Gramática Portuguesa'],
        complementar: ['Bosi — História Concisa da Literatura Brasileira', 'Jakobson — Linguística e Comunicação']
    },
    'Geografia': {
        fundamental: ['Magnoli — Geografia: a Ciência do Espaço caps. principais', 'Atlas Geográfico Escolar (IBGE)'],
        complementar: ['Relatórios do IPCC (AR5 e AR6)', 'Sachs — A Era do Desenvolvimento Sustentável']
    },
    'Política Internacional': {
        fundamental: ['Saraiva — História das Relações Internacionais caps. 1–8', 'Herz & Hoffmann — Organizações Internacionais'],
        complementar: ['Cervo — História da Política Exterior do Brasil caps. principais', 'Keohane & Nye — Power and Interdependence']
    },
    'Economia': {
        fundamental: ['Mankiw — Introdução à Economia', 'Vasconcellos — Economia: Micro e Macro'],
        complementar: ['Gremaud — Economia Brasileira Contemporânea', 'Krugman & Obstfeld — Economia Internacional']
    },
    'Direito Interno': {
        fundamental: ['Constituição Federal de 1988 (texto integral)', 'Di Pietro — Direito Administrativo'],
        complementar: ['Carvalho Filho — Manual de Direito Administrativo', 'Lenza — Direito Constitucional Esquematizado']
    },
    'Direito Internacional': {
        fundamental: ['Rezek — Direito Internacional Público', 'Convenção de Viena sobre Direito dos Tratados (1969)'],
        complementar: ['Mazzuoli — Curso de Direito Internacional Público', 'Shaw — International Law']
    },
    'Inglês': {
        fundamental: ['Oxford Advanced Learner\'s Grammar', 'The Economist — artigos recentes (seleção)'],
        complementar: ['Financial Times — artigos recentes', 'Swan — Practical English Usage']
    },
    'Espanhol': {
        fundamental: ['Gramática española em uso (nível avançado)', 'El País — artigos recentes'],
        complementar: ['RAE — Nueva gramática de la lengua española (resumo)', 'Larousse — Gramática de uso del español']
    },
    'Francês': {
        fundamental: ['Bescherelle — La Conjugaison pour tous', 'Grammaire progressive du français (nível avançado)'],
        complementar: ['Le Monde — artigos recentes', 'Grevisse — Le Bon Usage (excertos)']
    }
};

function getReadingKey(userId, lessonId, idx) { return 'reading_' + userId + '_' + lessonId + '_' + idx; }

function renderReadingsSection(subjectName, lessonId) {
    var readings = LESSON_READINGS[subjectName];
    if (!readings) return '';
    // Support both old flat array and new {fundamental, complementar} structure
    var fundamental = Array.isArray(readings) ? readings : (readings.fundamental || []);
    var complementar = Array.isArray(readings) ? [] : (readings.complementar || []);
    var all = fundamental.concat(complementar);
    if (all.length === 0) return '';
    var userId = state.user ? state.user.id : 'anon';
    var done = 0;
    all.forEach(function(r, i) {
        try { if (_store.getItem(getReadingKey(userId, lessonId, i)) === '1') done++; } catch(e) {}
    });
    function buildItems(list, offset) {
        return list.map(function(r, i) {
            var idx = offset + i;
            var checked = false;
            try { checked = _store.getItem(getReadingKey(userId, lessonId, idx)) === '1'; } catch(e) {}
            return '<div class="reading-item' + (checked ? ' done' : '') + '" id="ri-' + idx + '">' +
                '<input type="checkbox" id="rc-' + idx + '" ' + (checked ? 'checked' : '') + ' onchange="toggleReading(' + lessonId + ',' + idx + ',this.checked)">' +
                '<label for="rc-' + idx + '">' + escapeHtml(r) + '</label>' +
            '</div>';
        }).join('');
    }
    var funHtml = fundamental.length > 0
        ? '<div style="margin-bottom:12px"><div style="font-size:.8rem;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px"><i class="fas fa-star" style="margin-right:4px"></i>Leituras Fundamentais</div>' + buildItems(fundamental, 0) + '</div>'
        : '';
    var compHtml = complementar.length > 0
        ? '<div><div style="font-size:.8rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px"><i class="fas fa-plus-circle" style="margin-right:4px"></i>Leituras Complementares</div>' + buildItems(complementar, fundamental.length) + '</div>'
        : '';
    return '<div class="readings-section">' +
        '<h3><i class="fas fa-book-open"></i> Leituras Recomendadas — ' + escapeHtml(subjectName) + '</h3>' +
        '<div class="reading-progress" id="reading-progress-' + lessonId + '">' + done + '/' + all.length + ' leituras feitas</div>' +
        funHtml + compHtml +
    '</div>';
}

function toggleReading(lessonId, idx, checked) {
    var userId = state.user ? state.user.id : 'anon';
    try { _store.setItem(getReadingKey(userId, lessonId, idx), checked ? '1' : '0'); } catch(e) {}
    var item = document.getElementById('ri-' + idx);
    if (item) item.classList.toggle('done', checked);
    // Update counter
    var subjectName = null;
    Object.keys(LESSON_READINGS).forEach(function(k) {
        // find the currently rendered subject by checking rendered items
    });
    var total = 0, done = 0;
    var allItems = document.querySelectorAll('.reading-item');
    allItems.forEach(function(el, i) {
        total++;
        var cb = el.querySelector('input[type="checkbox"]');
        if (cb && cb.checked) done++;
    });
    var prog = document.getElementById('reading-progress-' + lessonId);
    if (prog) prog.textContent = done + '/' + total + ' leituras feitas';
}

function renderQuestionsSection(lessonId, subjectName, lessonTitle) {
    return '<div class="questions-section">' +
        '<h3><i class="fas fa-question-circle"></i> Questões CACD</h3>' +
        '<p style="font-size:.88rem;color:var(--text-muted);margin-bottom:16px">Questões no estilo das provas TPS do CACD geradas por IA para este tópico.</p>' +
        '<button class="btn btn-accent" id="gen-questions-btn" onclick="gerarQuestoes(' + lessonId + ',\'' + escapeHtml(subjectName).replace(/'/g,"\\'") + '\',\'' + escapeHtml(lessonTitle).replace(/'/g,"\\'") + '\')">' +
          '<i class="fas fa-brain"></i> Gerar Questões' +
        '</button>' +
        '<div id="questions-output" style="margin-top:16px"></div>' +
    '</div>';
}

var _lessonQuestoesMeta = { lessonId: null, subjectName: null, lessonTitle: null, currentCount: 0 };
var _currentSubject = '';
var _currentLesson = '';

function gerarQuestoes(lessonId, subjectName, lessonTitle) {
    _currentSubject = subjectName || '';
    _currentLesson = lessonTitle || '';
    var btn = document.getElementById('gen-questions-btn');
    var out = document.getElementById('questions-output');
    if (btn) { btn.disabled = true; btn.innerHTML = '<img src="/baron-reading-sm.png" style="width:20px;height:20px;border-radius:50%;vertical-align:middle;margin-right:6px" onerror="this.style.display=\'none\'"> Gerando questões…'; }
    baronFloatPose('reading', 10000);
    out.innerHTML = '';
    _lessonQuestoesMeta = { lessonId: lessonId, subjectName: subjectName, lessonTitle: lessonTitle, currentCount: 0 };
    API.generateQuestions({ lessonId: lessonId, subjectName: subjectName, lessonTitle: lessonTitle, count: 5 }).then(function(data) {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync"></i> Regerar Questões'; }
        var questoes = data.questoes || [];
        _lessonQuestoesMeta.currentCount = questoes.length;
        renderQuestoes(questoes, out);
        appendMaisQuestoesBtn(out, lessonId, subjectName, lessonTitle, questoes.length);
    }).catch(function(err) {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-brain"></i> Tentar Novamente'; }
        out.innerHTML = '<div style="color:var(--danger);font-size:.88rem"><i class="fas fa-exclamation-triangle"></i> ' + escapeHtml(err.message) + '</div>';
    });
}

function appendMaisQuestoesBtn(container, lessonId, subjectName, lessonTitle, currentCount) {
    var existing = container.querySelector('.mais-questoes-btn');
    if (existing) existing.remove();
    var btn = document.createElement('button');
    btn.className = 'btn btn-secondary mais-questoes-btn';
    btn.style.marginTop = '12px';
    btn.innerHTML = '<i class="fas fa-plus"></i> Mais questões';
    btn.onclick = function() { gerarMaisQuestoes(lessonId, subjectName, lessonTitle, currentCount); };
    container.appendChild(btn);
}

function gerarMaisQuestoes(lessonId, subjectName, lessonTitle, currentCount) {
    var out = document.getElementById('questions-output');
    var maisBtn = out ? out.querySelector('.mais-questoes-btn') : null;
    if (maisBtn) { maisBtn.disabled = true; maisBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando…'; }
    API.generateQuestions({ lessonId: lessonId, subjectName: subjectName, lessonTitle: lessonTitle, count: 5, offset: currentCount, forceNew: true }).then(function(data) {
        var newQuestoes = data.questoes || [];
        var newCount = currentCount + newQuestoes.length;
        // Append new question cards
        var tempDiv = document.createElement('div');
        var startIdx = currentCount;
        var html = newQuestoes.map(function(q, qi) {
            var idx = startIdx + qi;
            var opcoesHtml = ['a','b','c','d','e'].map(function(op) {
                var text = q.opcoes && q.opcoes[op] ? q.opcoes[op] : '';
                if (!text) return '';
                return '<label class="questao-opcao" for="q' + idx + op + '">' +
                    '<input type="radio" name="q' + idx + '" id="q' + idx + op + '" value="' + op + '">' +
                    '<span class="opcao-letra">' + op + ')</span>' +
                    '<span class="opcao-texto">' + escapeHtml(text) + '</span>' +
                    '</label>';
            }).join('');
            return '<div class="questao-card" id="qcard-' + idx + '" data-qid="' + escapeHtml(String(q.id||'')) + '">' +
                buildTopicBadge(q.id, q.subject, q.topic) +
                '<div class="questao-enunciado"><strong>Questão ' + (idx+1) + '.</strong></div>' + renderEnunciado(q.enunciado) +
                opcoesHtml +
                '<button class="btn btn-sm btn-secondary" style="margin-top:12px" onclick="conferirResposta(' + idx + ')">' +
                  '<i class="fas fa-check"></i> Conferir Resposta' +
                '</button>' +
                '<div class="questao-gabarito" id="qgab-' + idx + '"></div>' +
                '<div class="questao-explicacao" id="qexp-' + idx + '">' + escapeHtml(q.explicacao || '') + '</div>' +
            '</div>';
        }).join('');
        tempDiv.innerHTML = html;
        // Remove mais btn, insert new cards before score, re-add mais btn
        if (maisBtn) maisBtn.remove();
        var scoreEl = out.querySelector('.questoes-score');
        while (tempDiv.firstChild) {
            if (scoreEl) out.insertBefore(tempDiv.firstChild, scoreEl);
            else out.appendChild(tempDiv.firstChild);
        }
        // Extend _questoesAtivas
        _questoesAtivas = _questoesAtivas.concat(newQuestoes);
        appendMaisQuestoesBtn(out, lessonId, subjectName, lessonTitle, newCount);
    }).catch(function(err) {
        if (maisBtn) { maisBtn.disabled = false; maisBtn.innerHTML = '<i class="fas fa-plus"></i> Mais questões'; }
        showToast('Erro ao gerar mais questões: ' + err.message, 'error');
    });
}

var _questoesAtivas = [];

function renderQuestoes(questoes, container) {
    if (!questoes || questoes.length === 0) { container.innerHTML = '<p style="color:var(--text-muted);font-size:.88rem">Nenhuma questão disponível.</p>'; return; }
    _questoesAtivas = questoes;
    var html = questoes.map(function(q, qi) {
        var opcoesHtml = ['a','b','c','d','e'].map(function(op) {
            var text = q.opcoes && q.opcoes[op] ? q.opcoes[op] : '';
            if (!text) return '';
            return '<label class="questao-opcao" for="q' + qi + op + '">' +
                '<input type="radio" name="q' + qi + '" id="q' + qi + op + '" value="' + op + '">' +
                '<span class="opcao-letra">' + op + ')</span>' +
                '<span class="opcao-texto">' + escapeHtml(text) + '</span>' +
                '</label>';
        }).join('');
        var fonte = q.fonte ? '<div style="font-size:.78rem;color:var(--text-muted);margin-bottom:10px"><i class="fas fa-graduation-cap"></i> ' + escapeHtml(q.fonte) + '</div>' : '';
        return '<div class="questao-card" id="qcard-' + qi + '" data-qid="' + escapeHtml(String(q.id||'')) + '">' +
            buildTopicBadge(q.id, q.subject, q.topic) +
            '<div class="questao-enunciado"><strong>Questão ' + (qi+1) + '.</strong></div>' + renderEnunciado(q.enunciado) +
            fonte + opcoesHtml +
            '<button class="btn btn-sm btn-secondary" style="margin-top:12px" onclick="conferirResposta(' + qi + ')">' +
              '<i class="fas fa-check"></i> Conferir Resposta' +
            '</button>' +
            '<div class="questao-gabarito" id="qgab-' + qi + '"></div>' +
            '<div class="questao-explicacao" id="qexp-' + qi + '">' + escapeHtml(q.explicacao || '') + '</div>' +
        '</div>';
    }).join('');
    html += '<div class="questoes-score" id="questoes-score"></div>';
    container.innerHTML = html;
}

function conferirResposta(qi) {
    var q = _questoesAtivas[qi];
    if (!q) return;
    var radios = document.querySelectorAll('input[name="q' + qi + '"]');
    var selected = null;
    radios.forEach(function(r) { if (r.checked) selected = r.value; });
    var gabEl = document.getElementById('qgab-' + qi);
    var expEl = document.getElementById('qexp-' + qi);
    if (!selected) { showToast('Selecione uma opção antes de conferir', 'error'); return; }
    var gabarito = (q.gabarito || '').toLowerCase().trim();
    var correct = selected === gabarito;
    // Fire-and-forget attempt recording
    API.request('POST', '/api/questions', {
        action: 'record',
        subject: q.subject || _currentSubject,
        topic: q.topic || _currentLesson,
        question_id: q.question_id || null,
        correct: correct
    }).catch(function() {});
    if (gabEl) {
        gabEl.className = 'questao-gabarito show ' + (correct ? 'correct' : 'wrong');
        var baronImg = correct ? '/baron-thumbsup-sm.png' : '/baron-thinking-sm.png';
        var baronMsg = correct
            ? ['Excelente! Domínio de diplomata!','Perfeito! O Barão aprova!','Correto! Conhecimento sólido!','Muito bem! Assim se passa no CACD!'][Math.floor(Math.random()*4)]
            : ['Estude este ponto com atenção.','O Barão sugere rever este tema.','Não desanime — revise e avance!','Este tópico cai muito no CACD.'][Math.floor(Math.random()*4)];
        gabEl.innerHTML = '<div style="display:flex;align-items:center;gap:10px">' +
            '<img src="' + baronImg + '" style="width:36px;height:36px;border-radius:50%;flex-shrink:0" onerror="this.style.display=\'none\'">' +
            '<div>' + (correct
                ? '<strong><i class="fas fa-check-circle"></i> Correto!</strong> Alternativa <strong>' + gabarito.toUpperCase() + '</strong>. ' + baronMsg
                : '<strong><i class="fas fa-times-circle"></i> Incorreto.</strong> A correta é <strong>' + gabarito.toUpperCase() + '</strong>. ' + baronMsg) +
            '</div></div>';
        // Animate float button
        baronFloatPose(correct ? 'thumbsup' : 'thinking', 2500);
    }
    if (expEl) { expEl.textContent = q.explicacao || ''; expEl.classList.add('show'); }
    updateQuestoesScore();
}

function updateQuestoesScore() {
    var scoreEl = document.getElementById('questoes-score');
    if (!scoreEl) return;
    var total = document.querySelectorAll('.questao-card').length;
    var answered = document.querySelectorAll('.questao-gabarito.show').length;
    var correct = document.querySelectorAll('.questao-gabarito.show.correct').length;
    if (answered === total && total > 0) {
        scoreEl.classList.add('show');
        var pct = Math.round(correct/total*100);
        var medal = pct >= 80 ? '🏆' : pct >= 60 ? '🎖️' : '📚';
        scoreEl.innerHTML = medal + ' Resultado: <strong>' + correct + '/' + total + '</strong> acertos (' + pct + '%)' +
            (pct >= 80 ? ' — O Barão está orgulhoso!' : pct >= 60 ? ' — Bom progresso, continue!' : ' — Revise este tema antes da prova.');
        baronFloatPose(pct >= 80 ? 'thumbsup' : pct >= 60 ? 'winking' : 'thinking', 4000);
    }
}

function findLessonAndRender(subjects, lid, prog, nav) {
    // Try each subject until we find the lesson
    var allPromises = subjects.map(function(s) { return API.getLessons(s.id).then(function(ls) { return { subject:s, lessons:ls }; }); });
    return Promise.all(allPromises).then(function(results) {
        var lesson = null, subject = null, allLessons = [];
        for (var i = 0; i < results.length; i++) {
            var found = results[i].lessons.find(function(l) { return l.id === lid; });
            if (found) { lesson = found; subject = results[i].subject; allLessons = results[i].lessons; break; }
        }
        if (!lesson) { navigate('student-dashboard'); return; }

        var ts = lesson.duration_minutes * 60;
        var pp = ts > 0 ? Math.min(100, Math.round(prog.current_time_seconds/ts*100)) : 0;
        if (prog.completed) pp = 100;
        var sm = Math.floor(prog.current_time_seconds/60), ss = prog.current_time_seconds%60;
        var vh = lesson.embed_url ? '<div class="video-wrapper"><iframe src="'+escapeHtml(lesson.embed_url)+'" allow="autoplay; encrypted-media" allowfullscreen></iframe></div>' : '<div class="video-placeholder"><i class="fas fa-film"></i><p>Nenhum vídeo configurado para esta aula</p></div>';
        var rb = (prog.current_time_seconds > 0 && !prog.completed) ? '<div class="resume-banner"><i class="fas fa-play-circle"></i><span>Você parou em <strong>'+formatTime(prog.current_time_seconds)+'</strong> — avance o vídeo para essa posição</span></div>' : '';
        var ci = allLessons.findIndex(function(l){return l.id===lid;});
        var prev = ci>0 ? allLessons[ci-1] : null;
        var next = ci<allLessons.length-1 ? allLessons[ci+1] : null;
        var lnav = '<div class="lesson-nav">'+(prev?'<button class="btn btn-secondary" onclick="navigate(\'student-lesson\',{lessonId:'+prev.id+'})"><i class="fas fa-chevron-left"></i> '+escapeHtml(prev.title)+'</button>':'<div></div>')+(next?'<button class="btn btn-primary" onclick="navigate(\'student-lesson\',{lessonId:'+next.id+'})">'+escapeHtml(next.title)+' <i class="fas fa-chevron-right"></i></button>':'<div></div>')+'</div>';

        var readingsHtml = renderReadingsSection(subject.name, lid);
        var questionsHtml = renderQuestionsSection(lid, subject.name, lesson.title);

        var app = document.getElementById('app');
        app.innerHTML = nav + '<div class="container"><div class="page-content">' +
            '<div class="breadcrumb"><a onclick="navigate(\'student-dashboard\')">Matérias</a><span class="sep"><i class="fas fa-chevron-right"></i></span><a onclick="navigate(\'student-subject\',{subjectId:'+subject.id+'})">'+escapeHtml(subject.name)+'</a><span class="sep"><i class="fas fa-chevron-right"></i></span><span>'+escapeHtml(lesson.title)+'</span></div>' +
            '<h1 style="font-size:1.5rem;margin-bottom:20px">'+escapeHtml(lesson.title)+'</h1>' + rb + vh +
            readingsHtml +
            '<div class="progress-card"><h3><i class="fas fa-bookmark"></i> Salvar seu Progresso</h3><p style="font-size:.88rem;color:var(--text-muted);margin-bottom:16px">Registre o minuto e segundo atual do vídeo para retomar de onde parou.</p><div class="time-input-group"><div><label>Minutos</label><input type="number" id="progress-min" min="0" max="999" value="'+sm+'"></div><span class="time-sep">:</span><div><label>Segundos</label><input type="number" id="progress-sec" min="0" max="59" value="'+ss+'"></div><button class="btn btn-primary btn-sm" id="save-progress-btn" style="align-self:flex-end"><i class="fas fa-save"></i> Salvar</button></div><div class="progress-bar-full"><div class="fill" style="width:'+pp+'%"></div></div><div class="progress-info"><span>'+formatTime(prog.current_time_seconds)+' / '+formatTime(ts)+'</span><span>'+pp+'% concluído</span></div><div class="complete-toggle"><label class="toggle-switch"><input type="checkbox" id="complete-toggle" '+(prog.completed?'checked':'')+'><span class="toggle-slider"></span></label><span>Marcar como concluída</span></div>'+(prog.last_accessed?'<div style="margin-top:12px;font-size:.78rem;color:var(--text-muted)"><i class="fas fa-clock"></i> Último acesso: '+new Date(prog.last_accessed).toLocaleString('pt-BR')+'</div>':'')+'</div>' +
            questionsHtml +
            lnav + '</div></div>';

        // Bind progress events
        document.getElementById('save-progress-btn').addEventListener('click', function() {
            var mins=parseInt(document.getElementById('progress-min').value,10)||0;
            var secs=parseInt(document.getElementById('progress-sec').value,10)||0;
            if(secs>59)secs=59;if(mins<0)mins=0;if(secs<0)secs=0;
            var total = mins*60+secs;
            this.disabled=true; this.innerHTML='<i class="fas fa-spinner fa-spin"></i>';
            API.saveProgress({ lesson_id:lid, current_time_seconds:total }).then(function() {
                showToast('Progresso salvo: '+formatTime(total)); render();
            }).catch(function(err) { showToast(err.message,'error'); });
        });
        document.getElementById('complete-toggle').addEventListener('change', function() {
            var checked = this.checked;
            var subjectNameForPlan = subject.name;
            API.saveProgress({ lesson_id:lid, completed:checked }).then(function() {
                showToast(checked?'Aula marcada como concluída!':'Aula desmarcada');
                if (checked) {
                    // Find and check matching study item in active Plano Mestre week
                    API.request('GET', '/api/generate-macro-plan').then(function(macro) {
                        if (!macro || !macro.plan_json) return;
                        var today = new Date().toISOString().split('T')[0];
                        var sem = (macro.plan_json.semanas || []).find(function(s) { return s.dataInicio && s.dataFim && today >= s.dataInicio && today <= s.dataFim; });
                        if (!sem) return;
                        var item = (sem.materias || []).find(function(m) { return m.tipo === 'estudo' && !m.done && String(m.lesson_id) === String(lid); });
                        if (item && item.id) {
                            API.request('PUT', '/api/generate-macro-plan', { itemId: item.id, done: true }).catch(function() {});
                            showToast('Plano Mestre atualizado: ' + subjectNameForPlan + ' marcado como concluído!', 'success');
                        }
                    }).catch(function() {});
                }
                render();
            }).catch(function(err) { showToast(err.message,'error'); });
        });
    });
}

/* ============================================================
   VIEW: STUDENT SIMULADO
   ============================================================ */
var _simuladoAtivo = null; // { id, questoes, respostas, timer, timerInterval }
var _simuladoTimer = 0;
var _simuladoTimerInterval = null;
var _simuladoSaveTimeout = null;
var _simuladoLoadingActive = false;
var _simuladoCheckedActive = false;
var _simuladosEmAndamento = null;

var CACD_SUBJECTS = ['Português','História do Brasil','História Mundial','Política Internacional','Economia','Direito Interno','Direito Internacional','Geografia','Inglês','Inglês','Inglês'];
var CACD_SUBJECTS_LIST = ['Português','História do Brasil','História Mundial','Política Internacional','Economia','Direito Interno','Direito Internacional','Geografia','Inglês'];

function renderStudentSimulado() {
    var app = document.getElementById('app');
    var nav = renderNavbar(studentNav());

    if (_simuladoAtivo) {
        renderSimuladoAtivo(_simuladoAtivo.id, _simuladoAtivo.questoes);
        return;
    }
    if (!_simuladoCheckedActive && !_simuladoLoadingActive) {
        _simuladoLoadingActive = true;
        app.innerHTML = nav + '<div class="container"><div class="page-content"><div class="loading"><i class="fas fa-spinner fa-spin"></i> Verificando simulados em andamento...</div></div></div>';
        API.getActiveSimulado().then(function(data) {
            _simuladoLoadingActive = false;
            _simuladoCheckedActive = true;
            if (data && data.simulado) {
                var respostas = {};
                (data.simulado.questoes || []).forEach(function(q, i) { if (q.user_answer) respostas[i] = q.user_answer; });
                _simuladoAtivo = { id: data.simulado.id, questoes: data.simulado.questoes, respostas: respostas, elapsedSeconds: data.simulado.elapsed_seconds || 0 };
                renderSimuladoAtivo(_simuladoAtivo.id, _simuladoAtivo.questoes);
            } else {
                renderStudentSimulado();
            }
        }).catch(function() { _simuladoLoadingActive = false; _simuladoCheckedActive = true; showToast('Não foi possível verificar simulados em andamento.', 'info'); renderStudentSimulado(); });
        return;
    }

    var ongoingHtml = '<div class="simulado-card" id="simulados-andamento"><h2 style="margin-bottom:4px;font-size:1.25rem"><span class="subject-icon" style="width:38px;height:38px;margin-right:10px;display:inline-flex"><i class="fas fa-clock-rotate-left"></i></span>Simulados em andamento</h2>';
    if (_simuladosEmAndamento === null) {
        ongoingHtml += '<p style="font-size:.9rem;color:var(--text-secondary);margin-top:10px"><i class="fas fa-spinner fa-spin"></i> Carregando simulados salvos...</p>';
    } else if (!_simuladosEmAndamento.length) {
        ongoingHtml += '<p style="font-size:.9rem;color:var(--text-secondary);margin-top:10px">Você ainda não tem simulados pausados ou em andamento.</p>';
    } else {
        ongoingHtml += _simuladosEmAndamento.map(function(sim) {
            var answered = (sim.questoes || []).filter(function(q) { return q.user_answer; }).length;
            var total = sim.total || (sim.questoes || []).length;
            var started = sim.started_at ? new Date(sim.started_at).toLocaleDateString('pt-BR') : 'data desconhecida';
            var tipo = sim.tipo === 'cacd' ? 'CACD' : 'Personalizado';
            return '<div class="simulado-ongoing-row">' +
                '<div><strong>' + escapeHtml(tipo) + '</strong><small>' + answered + '/' + total + ' respondidas • iniciado em ' + escapeHtml(started) + ' • tempo: ' + formatTime(sim.elapsed_seconds || 0) + '</small></div>' +
                '<button class="btn btn-primary" onclick="retomarSimulado(' + sim.id + ')"><i class="fas fa-play"></i> Continuar</button>' +
            '</div>';
        }).join('');
    }
    ongoingHtml += '</div>';

    var subjectCheckboxes = CACD_SUBJECTS_LIST.map(function(s, i) {
        return '<div class="custom-subject-row">' +
            '<input type="checkbox" id="sim-sub-' + i + '" value="' + escapeHtml(s) + '" style="width:18px;height:18px;accent-color:var(--primary)">' +
            '<label for="sim-sub-' + i + '" style="font-size:.95rem;font-weight:500">' + escapeHtml(s) + '</label>' +
            '<div class="qty-control"><button type="button" onclick="var i=document.getElementById(\'sim-sub-count-' + i + '\');i.value=Math.max(1,(parseInt(i.value)||5)-1)">−</button><input type="number" id="sim-sub-count-' + i + '" min="1" max="20" value="5"><button type="button" onclick="var i=document.getElementById(\'sim-sub-count-' + i + '\');i.value=Math.min(20,(parseInt(i.value)||5)+1)">+</button></div>' +
            '</div>';
    }).join('');

    var fonteOptions = function(prefix) {
        return ['<label class="simulado-choice"><input type="radio" name="fonte-'+prefix+'" value="real" style="accent-color:var(--primary)"><span class="choice-icon"><i class="fas fa-file-circle-check"></i></span><span><strong>Questões de provas anteriores</strong><small style="display:block;color:var(--text-secondary);margin-top:3px">Baseado em questões cobradas em provas oficiais do CACD.</small></span><span class="zen-pill"><i class="fas fa-landmark"></i> Histórico oficial</span></label>',
                '<label class="simulado-choice"><input type="radio" name="fonte-'+prefix+'" value="ai" checked style="accent-color:var(--primary)"><span class="choice-icon"><i class="fas fa-star"></i></span><span><strong>Questões geradas pela IA</strong><small style="display:block;color:var(--text-secondary);margin-top:3px">Questões inéditas criadas com base no estilo da banca.</small></span><span class="zen-pill"><i class="fas fa-magic"></i> Inédito</span></label>',
                '<label class="simulado-choice"><input type="radio" name="fonte-'+prefix+'" value="mixed" style="accent-color:var(--primary)"><span class="choice-icon"><i class="fas fa-shuffle"></i></span><span><strong>Misturar (provas + IA)</strong><small style="display:block;color:var(--text-secondary);margin-top:3px">Combina questões oficiais com inéditas para um treino completo.</small></span><span class="zen-pill"><i class="fas fa-star"></i> Recomendado</span></label>'].join('');
    };

    app.innerHTML = nav + '<div class="container"><div class="page-content">' +
        zenTitle('fa-pen-to-square', 'Simulado', 'Teste seus conhecimentos com simulados no estilo CACD.') +
        ongoingHtml +
        '<div class="simulado-card">' +
            '<h2 style="margin-bottom:4px;font-size:1.45rem"><span class="subject-icon" style="width:44px;height:44px;margin-right:12px;display:inline-flex"><i class="fas fa-landmark"></i></span>Simulado CACD</h2>' +
            '<p style="font-size:.92rem;color:var(--text-secondary);margin-bottom:18px">65 questões distribuídas pelas 9 matérias do CACD, conforme distribuição oficial.</p>' +
            '<div style="border:1px solid var(--border-warm);border-radius:18px;overflow:hidden;background:rgba(255,255,255,.58)">' + fonteOptions('cacd') + '</div>' +
            '<button class="btn btn-primary" style="margin-top:18px;width:100%;justify-content:center;padding:14px" id="btn-iniciar-cacd"><i class="fas fa-play"></i> Iniciar Simulado CACD</button>' +
        '</div>' +
        '<div class="simulado-card">' +
            '<h2 style="margin-bottom:4px;font-size:1.45rem"><span class="subject-icon" style="width:44px;height:44px;margin-right:12px;display:inline-flex"><i class="fas fa-sliders"></i></span>Simulado Personalizado</h2>' +
            '<p style="font-size:.92rem;color:var(--text-secondary);margin-bottom:16px">Escolha as matérias e quantidade de questões.</p>' +
            '<div style="margin-bottom:18px;border:1px solid var(--border-warm);border-radius:18px;padding:12px 20px;background:rgba(255,255,255,.58)"><label style="font-size:.9rem;font-weight:700;color:var(--text-strong);display:block;margin-bottom:6px">Matérias e quantidade de questões</label>' + subjectCheckboxes + '</div>' +
            '<div style="border:1px solid var(--border-warm);border-radius:18px;overflow:hidden;background:rgba(255,255,255,.58)">' + fonteOptions('custom') + '</div>' +
            '<button class="btn btn-primary" style="margin-top:18px;width:100%;justify-content:center;padding:14px" id="btn-criar-custom"><i class="fas fa-play"></i> Criar Simulado</button>' +
        '</div>' +
    '</div></div>';

    document.getElementById('btn-iniciar-cacd').addEventListener('click', function() {
        var fonte = document.querySelector('input[name="fonte-cacd"]:checked');
        criarSimulado('cacd', { fonte: fonte ? fonte.value : 'ai' });
    });

    document.getElementById('btn-criar-custom').addEventListener('click', function() {
        var subjects = [];
        CACD_SUBJECTS_LIST.forEach(function(s, i) {
            var cb = document.getElementById('sim-sub-' + i);
            if (cb && cb.checked) {
                var cnt = parseInt(document.getElementById('sim-sub-count-' + i).value) || 5;
                subjects.push({ subject: s, count: cnt });
            }
        });
        if (subjects.length === 0) { showToast('Selecione ao menos uma matéria', 'error'); return; }
        var fonte = document.querySelector('input[name="fonte-custom"]:checked');
        criarSimulado('custom', { subjects: subjects, fonte: fonte ? fonte.value : 'ai' });
    });

    if (_simuladosEmAndamento === null && !_simuladoLoadingActive) {
        _simuladoLoadingActive = true;
        API.getOngoingSimulados().then(function(data) {
            _simuladoLoadingActive = false;
            _simuladosEmAndamento = data && data.simulados ? data.simulados : [];
            if (!_simuladoAtivo) renderStudentSimulado();
        }).catch(function() {
            _simuladoLoadingActive = false;
            _simuladosEmAndamento = [];
            showToast('Não foi possível carregar simulados em andamento.', 'info');
            if (!_simuladoAtivo) renderStudentSimulado();
        });
    }
}

function retomarSimulado(simuladoId) {
    var lista = _simuladosEmAndamento || [];
    var sim = lista.find(function(item) { return String(item.id) === String(simuladoId); });
    if (!sim) { showToast('Simulado em andamento não encontrado.', 'error'); return; }
    var respostas = {};
    (sim.questoes || []).forEach(function(q, i) { if (q.user_answer) respostas[i] = q.user_answer; });
    _simuladoAtivo = { id: sim.id, questoes: sim.questoes || [], respostas: respostas, elapsedSeconds: sim.elapsed_seconds || 0 };
    renderSimuladoAtivo(_simuladoAtivo.id, _simuladoAtivo.questoes);
}

function criarSimulado(tipo, config) {
    var btn = document.getElementById(tipo === 'cacd' ? 'btn-iniciar-cacd' : 'btn-criar-custom');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparando simulado…'; }

    API.createSimulado({ tipo: tipo, config: config }).then(function(data) {
        _simuladosEmAndamento = null;
        _simuladoCheckedActive = true;
        _simuladoAtivo = { id: data.simuladoId, questoes: data.questoes, respostas: {}, elapsedSeconds: 0 };
        renderSimuladoAtivo(data.simuladoId, data.questoes);
    }).catch(function(err) {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-play"></i> ' + (tipo === 'cacd' ? 'Iniciar Simulado CACD' : 'Criar Simulado'); }
        showToast('Erro ao criar simulado: ' + err.message, 'error');
    });
}

function renderSimuladoAtivo(simuladoId, questoes) {
    var app = document.getElementById('app');
    var nav = renderNavbar(studentNav());

    // Start or resume timer
    if (_simuladoTimerInterval) clearInterval(_simuladoTimerInterval);
    _simuladoTimer = _simuladoAtivo && _simuladoAtivo.elapsedSeconds ? _simuladoAtivo.elapsedSeconds : 0;
    _simuladoTimerInterval = setInterval(function() {
        _simuladoTimer++;
        var el = document.getElementById('simulado-timer');
        if (el) el.textContent = formatTime(_simuladoTimer);
        if (_simuladoAtivo) _simuladoAtivo.elapsedSeconds = _simuladoTimer;
    }, 1000);

    var questoesHtml = (questoes || []).map(function(q, qi) {
        var opcoesHtml = ['a','b','c','d','e'].map(function(op) {
            var text = q.opcoes && q.opcoes[op] ? q.opcoes[op] : '';
            if (!text) return '';
            return '<label class="questao-opcao" for="sq' + qi + op + '">' +
                '<input type="radio" name="sq' + qi + '" id="sq' + qi + op + '" value="' + op + '"' + ((_simuladoAtivo && _simuladoAtivo.respostas && _simuladoAtivo.respostas[qi] === op) || q.user_answer === op ? ' checked' : '') + ' onchange="registrarResposta(' + qi + ',this.value)">' +
                '<span class="opcao-letra">' + op + ')</span>' +
                '<span class="opcao-texto">' + escapeHtml(text) + '</span>' +
                '</label>';
        }).join('');
        return '<div class="questao-card" id="sqcard-' + qi + '" data-qid="' + escapeHtml(String(q.id||'')) + '" style="border-left:3px solid var(--border)">' +
            buildTopicBadge(q.id, q.subject, q.topic) +
            '<div class="questao-enunciado"><strong>Questão ' + (qi+1) + '.</strong></div>' + renderEnunciado(q.enunciado) +
            opcoesHtml +
        '</div>';
    }).join('');

    app.innerHTML = nav + '<div class="container"><div class="page-content">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px">' +
            '<div>' +
                '<h1 style="margin:0;font-size:1.3rem">Simulado em Andamento</h1>' +
                '<div class="simulado-progress" id="simulado-answered">' + (_simuladoAtivo ? Object.keys(_simuladoAtivo.respostas || {}).length : 0) + '/' + questoes.length + ' respondidas</div>' +
            '</div>' +
            '<div style="text-align:right">' +
                '<div class="simulado-timer" id="simulado-timer">' + formatTime(_simuladoTimer) + '</div>' +
            '</div>' +
        '</div>' +
        questoesHtml +
        '<div style="margin-top:24px;padding-top:24px;border-top:1px solid var(--border);text-align:center">' +
            '<button class="btn" id="btn-pausar-simulado" onclick="pausarSimulado(' + simuladoId + ')" style="margin-right:10px">' +
                '<i class="fas fa-pause"></i> Pausar' +
            '</button>' +
            '<button class="btn btn-danger" id="btn-cancelar-simulado" onclick="cancelarSimulado(' + simuladoId + ')" style="margin-right:10px">' +
                '<i class="fas fa-trash"></i> Cancelar' +
            '</button>' +
            '<button class="btn btn-primary" id="btn-finalizar-simulado" onclick="finalizarSimulado(' + simuladoId + ',' + questoes.length + ')">' +
                '<i class="fas fa-flag-checkered"></i> Finalizar Simulado' +
            '</button>' +
            '<p style="font-size:.8rem;color:var(--text-muted);margin-top:8px">Questões não respondidas serão contadas como erradas.</p>' +
        '</div>' +
    '</div></div>';
}

function registrarResposta(qi, value) {
    if (_simuladoAtivo) {
        _simuladoAtivo.respostas[qi] = value;
        var answered = Object.keys(_simuladoAtivo.respostas).length;
        var total = _simuladoAtivo.questoes ? _simuladoAtivo.questoes.length : 0;
        var el = document.getElementById('simulado-answered');
        if (el) el.textContent = answered + '/' + total + ' respondidas';
        // Highlight answered card
        var card = document.getElementById('sqcard-' + qi);
        if (card) card.style.borderLeftColor = 'var(--primary)';
        agendarSalvarSimulado();
    }
}

function agendarSalvarSimulado() {
    if (!_simuladoAtivo || !API.saveSimulado) return;
    if (_simuladoSaveTimeout) clearTimeout(_simuladoSaveTimeout);
    _simuladoSaveTimeout = setTimeout(function() {
        salvarSimuladoAtual(false);
    }, 700);
}

function salvarSimuladoAtual(showSuccess) {
    if (!_simuladoAtivo || !API.saveSimulado) return Promise.resolve();
    return API.saveSimulado(_simuladoAtivo.id, _simuladoAtivo.respostas || {}, _simuladoTimer).then(function(data) {
        if (data && data.simulado) {
            _simuladoAtivo.elapsedSeconds = data.simulado.elapsed_seconds || _simuladoTimer;
        }
        if (showSuccess) showToast('Simulado pausado. Você poderá continuar depois.', 'success');
    }).catch(function(err) {
        showToast('Não foi possível salvar o simulado: ' + err.message, 'error');
        throw err;
    });
}

function pausarSimulado(simuladoId) {
    var btn = document.getElementById('btn-pausar-simulado');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }
    if (_simuladoSaveTimeout) { clearTimeout(_simuladoSaveTimeout); _simuladoSaveTimeout = null; }
    if (_simuladoTimerInterval) { clearInterval(_simuladoTimerInterval); _simuladoTimerInterval = null; }
    salvarSimuladoAtual(true).then(function() {
        _simuladoAtivo = null;
        _simuladosEmAndamento = null;
        _simuladoCheckedActive = false;
        navigate('student-simulado');
    }).catch(function() {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-pause"></i> Pausar e continuar depois'; }
        renderSimuladoAtivo(simuladoId, _simuladoAtivo ? _simuladoAtivo.questoes : []);
    });
}

function cancelarSimulado(simuladoId) {
    showConfirmModal(
        'Cancelar Simulado',
        'Tem certeza que deseja cancelar este simulado? Todas as respostas salvas serão perdidas.',
        'Cancelar simulado',
        'btn-danger',
        function() { _doCancelarSimulado(simuladoId); }
    );
}

function _doCancelarSimulado(simuladoId) {
    var btn = document.getElementById('btn-cancelar-simulado');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cancelando...'; }
    if (_simuladoSaveTimeout) { clearTimeout(_simuladoSaveTimeout); _simuladoSaveTimeout = null; }
    if (_simuladoTimerInterval) { clearInterval(_simuladoTimerInterval); _simuladoTimerInterval = null; }
    API.cancelSimulado(simuladoId).then(function() {
        _simuladoAtivo = null;
        _simuladosEmAndamento = null;
        showToast('Simulado cancelado.', 'success');
        navigate('student-simulado');
    }).catch(function(err) {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash"></i> Cancelar'; }
        showToast('Erro ao cancelar: ' + err.message, 'error');
        if (_simuladoAtivo) renderSimuladoAtivo(simuladoId, _simuladoAtivo.questoes || []);
    });
}

function finalizarSimulado(simuladoId, total) {
    var btn = document.getElementById('btn-finalizar-simulado');
    var answered = _simuladoAtivo ? Object.keys(_simuladoAtivo.respostas).length : 0;
    if (answered < total) {
        // Confirm even with unanswered
        showConfirmModal(
            'Finalizar Simulado',
            answered + ' de ' + total + ' questões respondidas. Questões em branco serão erradas. Deseja finalizar?',
            'Finalizar',
            'btn-primary',
            function() { _doFinalizarSimulado(simuladoId, btn); }
        );
    } else {
        _doFinalizarSimulado(simuladoId, btn);
    }
}

function _doFinalizarSimulado(simuladoId, btn) {
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculando resultado…'; }
    if (_simuladoTimerInterval) { clearInterval(_simuladoTimerInterval); _simuladoTimerInterval = null; }

    var respostas = _simuladoAtivo ? _simuladoAtivo.respostas : {};
    if (_simuladoSaveTimeout) { clearTimeout(_simuladoSaveTimeout); _simuladoSaveTimeout = null; }
    API.submitSimulado(simuladoId, respostas).then(function(data) {
        _simuladoAtivo = null;
        _simuladosEmAndamento = null;
        renderSimuladoResult(data);
    }).catch(function(err) {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-flag-checkered"></i> Finalizar Simulado'; }
        showToast('Erro ao finalizar: ' + err.message, 'error');
    });
}

function renderSimuladoResult(data) {
    var app = document.getElementById('app');
    var nav = renderNavbar(studentNav());
    var score = data.score || 0;
    var total = data.total || 1;
    var pct = Math.round(score / total * 100);
    var questoes = data.questoes_with_gabarito || [];
    var subjectStats = data.subject_stats || {};

    var subjectRows = Object.keys(subjectStats).map(function(s) {
        var st = subjectStats[s];
        var spct = Math.round(st.correct / st.total * 100);
        var color = spct >= 70 ? 'var(--primary)' : spct >= 50 ? 'var(--accent)' : 'var(--jade-soft)';
        return '<div class="simulado-subject-row">' +
            '<span>' + escapeHtml(s) + '</span>' +
            '<span style="font-weight:700;color:' + color + '">' + st.correct + '/' + st.total + ' (' + spct + '%)</span>' +
        '</div>';
    }).join('');

    var questoesReviewHtml = questoes.map(function(q, qi) {
        var correct = q.is_correct;
        var userAns = q.user_answer || '—';
        var gab = (q.gabarito || '').toUpperCase();
        var borderColor = correct ? 'var(--success)' : (q.user_answer ? 'var(--danger)' : 'var(--border)');
        var opcoesHtml = ['a','b','c','d','e'].map(function(op) {
            var text = q.opcoes && q.opcoes[op] ? q.opcoes[op] : '';
            if (!text) return '';
            var isGab = op === (q.gabarito||'').toLowerCase();
            var isUser = op === (q.user_answer||'').toLowerCase();
            var bg = isGab ? 'background:rgba(var(--success-rgb,40,167,69),0.12);border-color:var(--success)' : (isUser && !correct ? 'background:rgba(var(--danger-rgb,220,53,69),0.12);border-color:var(--danger)' : '');
            return '<div class="questao-opcao" style="' + bg + ';border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:4px">' +
                '<span class="opcao-letra">' + op + ')</span>' +
                '<span class="opcao-texto">' + escapeHtml(text) + '</span>' +
                (isGab ? '<span style="margin-left:auto;font-size:.75rem;color:var(--success);font-weight:700">✓ Correto</span>' : '') +
                (isUser && !correct ? '<span style="margin-left:auto;font-size:.75rem;color:var(--danger);font-weight:700">✗ Sua resp.</span>' : '') +
            '</div>';
        }).join('');
        var expHtml = q.explicacao ? '<div style="margin-top:10px;padding:10px 12px;background:var(--primary-light);border-radius:var(--radius-sm);font-size:.83rem;color:var(--text)">' + escapeHtml(q.explicacao) + '</div>' : '';
        var qid = q.id || q.question_id || '';
        return '<div class="questao-card" data-qid="' + escapeHtml(String(qid)) + '" style="border-left:3px solid ' + borderColor + '">' +
            buildTopicBadge(qid, q.subject, q.topic) +
            '<div style="font-size:.75rem;font-weight:700;color:var(--text-muted);margin-bottom:4px">' + escapeHtml(q.subject || '') + ' • ' + (correct ? '<span style="color:var(--success)">Correta</span>' : q.user_answer ? '<span style="color:var(--danger)">Errada</span>' : '<span style="color:var(--text-muted)">Não respondida</span>') + '</div>' +
            '<div class="questao-enunciado"><strong>Questão ' + (qi+1) + '.</strong></div>' + renderEnunciado(q.enunciado) +
            opcoesHtml + expHtml +
        '</div>';
    }).join('');

    app.innerHTML = nav + '<div class="container"><div class="page-content">' +
        '<div class="simulado-result">' +
            '<div style="font-size:1rem;color:var(--text-muted);margin-bottom:8px">Resultado do Simulado</div>' +
            '<div class="simulado-score">' + score + '/' + total + '</div>' +
            '<div style="font-size:1.4rem;font-weight:700;margin:8px 0;color:' + (pct>=70?'var(--primary)':pct>=50?'var(--accent)':'var(--jade-soft)') + '">' + pct + '%</div>' +
            '<div style="font-size:.9rem;color:var(--text-muted);margin-bottom:24px">acertos</div>' +
            '<button class="btn btn-primary" onclick="_simuladoAtivo=null;navigate(\'student-simulado\')"><i class="fas fa-redo"></i> Novo Simulado</button>' +
        '</div>' +
        '<h3 style="margin-bottom:12px">Resultado por Matéria</h3>' +
        '<div style="margin-bottom:28px">' + subjectRows + '</div>' +
        '<h3 style="margin-bottom:12px">Revisão das Questões</h3>' +
        questoesReviewHtml +
    '</div></div>';
}

/* ============================================================
   VIEW: STUDENT MACRO PLAN
   ============================================================ */
function renderStudentMacroPlan() {
    var app = document.getElementById('app');
    var nav = renderNavbar(studentNav());
    app.innerHTML = nav + '<div class="container"><div class="page-content">' +
        zenTitle('fa-map', 'Plano Mestre CACD', 'Escolha seu ritmo diário ou uma data-alvo; o Barão distribui 100% do conteúdo.') +
        '<div class="loading-spinner" id="macro-main-area"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>' +
        '</div></div>';

    API.request('GET', '/api/generate-macro-plan').then(function(macro) {
        var area = document.getElementById('macro-main-area');
        if (!area) return;

        var currentPlan = macro && macro.plan_json ? macro.plan_json : null;
        var todayIso = new Date().toISOString().split('T')[0];
        var suggestedExam = new Date(); suggestedExam.setMonth(suggestedExam.getMonth() + 4);
        var defaultMode = currentPlan && currentPlan.modoPlanejamento === 'data_prova' ? 'data_prova' : 'aulas_por_dia';
        var savedExamDate = currentPlan && currentPlan.dataProva;
        var defaultDate = savedExamDate && savedExamDate >= todayIso ? savedExamDate : suggestedExam.toISOString().split('T')[0];
        var existingDate = macro && macro.created_at ? new Date(macro.created_at).toLocaleDateString('pt-BR') : null;

        var formHtml = '<div class="macro-form" id="macro-gen-form">' +
            '<h2><i class="fas fa-cog" style="color:var(--accent);margin-right:8px"></i>' + (existingDate ? 'Substituir Plano Mestre' : 'Configurar Plano Mestre') + '</h2>' +
            (existingDate ? '<div style="background:rgba(232,163,23,.12);border:1px solid var(--warning);border-radius:var(--radius-md);padding:12px 16px;margin-bottom:16px;font-size:.88rem"><i class="fas fa-exclamation-triangle" style="color:var(--warning);margin-right:6px"></i>Você já tem um Plano Mestre criado em ' + existingDate + '. Gerar um novo irá <strong>redistribuir todas as aulas e revisões conforme o modo escolhido</strong>.</div>' : '') +
            '<div class="macro-mode-options">' +
              '<label class="macro-mode-option' + (defaultMode === 'aulas_por_dia' ? ' active' : '') + '">' +
                '<input type="radio" name="macro-modo" value="aulas_por_dia"' + (defaultMode === 'aulas_por_dia' ? ' checked' : '') + ' onchange="atualizarModoMacroPlan()">' +
                '<span class="macro-mode-icon"><i class="fas fa-gauge-high"></i></span>' +
                '<span><strong>Aulas por dia</strong><small>Você define o ritmo e os dias de descanso. O plano calcula quantos dias serão necessários.</small></span>' +
              '</label>' +
              '<label class="macro-mode-option' + (defaultMode === 'data_prova' ? ' active' : '') + '">' +
                '<input type="radio" name="macro-modo" value="data_prova"' + (defaultMode === 'data_prova' ? ' checked' : '') + ' onchange="atualizarModoMacroPlan()">' +
                '<span class="macro-mode-icon"><i class="fas fa-calendar-check"></i></span>' +
                '<span><strong>Data da prova</strong><small>Você informa somente a data. O plano calcula e distribui a quantidade necessária de aulas por dia.</small></span>' +
              '</label>' +
            '</div>' +
            '<div id="macro-mode-aulas" style="display:' + (defaultMode === 'aulas_por_dia' ? 'block' : 'none') + '">' +
              '<div class="form-row">' +
                '<div class="form-group"><label>Aulas por Dia</label><input type="number" id="macro-aulas-dia" min="1" max="20" value="' + (currentPlan && currentPlan.aulasPorDia ? currentPlan.aulasPorDia : 2) + '"' + (defaultMode === 'aulas_por_dia' ? '' : ' disabled') + '><small style="display:block;color:var(--text-muted);margin-top:5px">O plano incluirá 100% das aulas e calculará a duração total.</small></div>' +
                '<div class="form-group"><label>Dias de Descanso por Semana</label><input type="number" id="macro-dias-descanso" min="0" max="6" value="' + (currentPlan && currentPlan.diasDescansoPorSemana != null ? currentPlan.diasDescansoPorSemana : 1) + '"' + (defaultMode === 'aulas_por_dia' ? '' : ' disabled') + '><small style="display:block;color:var(--text-muted);margin-top:5px">De 0 a 6 dias sem aulas ou revisões, intercalados automaticamente.</small></div>' +
              '</div>' +
            '</div>' +
            '<div id="macro-mode-prova" style="display:' + (defaultMode === 'data_prova' ? 'block' : 'none') + '">' +
              '<div class="form-group"><label>Data da Prova</label><input type="date" id="macro-data-prova" min="' + todayIso + '" value="' + defaultDate + '"' + (defaultMode === 'data_prova' ? '' : ' disabled') + '><small style="display:block;color:var(--text-muted);margin-top:5px">As aulas serão equilibradas entre hoje e a prova; o teto diário será calculado automaticamente.</small></div>' +
            '</div>' +
            '<button class="btn btn-primary" style="width:100%;justify-content:center;padding:14px" onclick="gerarMacroPlan()">' +
              '<i class="fas fa-calendar-check"></i> ' + (existingDate ? 'Gerar Novo Plano Mestre' : 'Gerar Plano Mestre') +
            '</button>' +
          '</div>' +
          '<div id="macro-output" class="macro-output" style="display:none"></div>';

        if (macro && macro.plan_json) {
            var isExamDateMode = currentPlan.modoPlanejamento === 'data_prova';
            var planExamLabel = isExamDateMode && currentPlan.dataProva ? new Date(currentPlan.dataProva + 'T12:00:00').toLocaleDateString('pt-BR') : null;
            var planModeLead = isExamDateMode ? 'Prova em ' + planExamLabel : 'Ritmo definido pelo aluno';
            var planModeDetails = isExamDateMode
                ? (currentPlan.totalAulas || 0) + ' aulas · até ' + (currentPlan.aulasPorDia || 0) + ' por dia (calculado) · conteúdo concluído até ' + planExamLabel
                : (currentPlan.totalAulas || 0) + ' aulas · ' + (currentPlan.aulasPorDia || 0) + ' por dia · ' + (currentPlan.diasDescansoPorSemana || 0) + ' descanso(s)/semana · aulas até ' + (currentPlan.dataFimAulas ? new Date(currentPlan.dataFimAulas + 'T12:00:00').toLocaleDateString('pt-BR') : '—');
            area.className = '';
            area.innerHTML = '<div class="zen-hero" style="min-height:134px;margin-bottom:22px">' +
                '<img class="zen-hero-avatar" src="/baron-thinking-sm.png" alt="Barão" onerror="this.src=\'/baron-avatar.png\'">' +
                '<div><h2 style="font-size:1.55rem;margin-bottom:6px">Seu Plano Mestre está ativo</h2>' +
                '<p>Criado em ' + existingDate + ' · ' + planModeLead + '</p>' +
                '<p style="font-size:.86rem;margin-top:8px"><i class="fas fa-circle-info" style="color:var(--accent);margin-right:6px"></i>' + planModeDetails + '</p></div>' +
                '<div style="margin-left:auto;align-self:center;display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">' +
                  '<button id="macro-reschedule-btn" class="btn btn-primary btn-sm" onclick="atualizarDatasMacroPlan()"><i class="fas fa-calendar-day"></i> Atualizar datas atrasadas</button>' +
                  '<button class="btn btn-secondary btn-sm" onclick="document.getElementById(\'macro-gen-form-wrap\').style.display=document.getElementById(\'macro-gen-form-wrap\').style.display===\'none\'?\'block\':\'none\'">' +
                    '<i class="fas fa-sync"></i> Recriar plano' +
                  '</button>' +
                '</div></div>' +
                '<div id="macro-gen-form-wrap" style="display:none">' + formHtml + '</div>';
            var tempDiv = document.createElement('div');
            tempDiv.className = 'macro-output';
            tempDiv.style.display = 'block';
            area.appendChild(tempDiv);
            renderMacroPlan(macro.plan_json, tempDiv);
        } else {
            area.className = '';
            area.innerHTML = formHtml;
        }
    }).catch(function() {
        var area = document.getElementById('macro-main-area');
        if (area) { area.className = ''; area.innerHTML = '<p style="color:var(--danger)">Erro ao carregar plano.</p>'; }
    });
}

function atualizarModoMacroPlan() {
    var selected = document.querySelector('input[name="macro-modo"]:checked');
    if (!selected) return;
    var isLessonsMode = selected.value === 'aulas_por_dia';
    var lessonsBlock = document.getElementById('macro-mode-aulas');
    var examBlock = document.getElementById('macro-mode-prova');
    var lessonsInput = document.getElementById('macro-aulas-dia');
    var restInput = document.getElementById('macro-dias-descanso');
    var examInput = document.getElementById('macro-data-prova');

    if (lessonsBlock) lessonsBlock.style.display = isLessonsMode ? 'block' : 'none';
    if (examBlock) examBlock.style.display = isLessonsMode ? 'none' : 'block';
    if (lessonsInput) lessonsInput.disabled = !isLessonsMode;
    if (restInput) restInput.disabled = !isLessonsMode;
    if (examInput) examInput.disabled = isLessonsMode;
    document.querySelectorAll('.macro-mode-option').forEach(function(option) {
        var radio = option.querySelector('input[type="radio"]');
        option.classList.toggle('active', Boolean(radio && radio.checked));
    });
}

function gerarMacroPlan() {
    var selectedMode = document.querySelector('input[name="macro-modo"]:checked');
    var mode = selectedMode ? selectedMode.value : null;
    var payload = { modoPlanejamento: mode };

    if (mode === 'aulas_por_dia') {
        var aulasPorDia = parseInt(document.getElementById('macro-aulas-dia').value, 10);
        var diasDescansoPorSemana = parseInt(document.getElementById('macro-dias-descanso').value, 10);
        if (!Number.isFinite(aulasPorDia) || aulasPorDia < 1 || aulasPorDia > 20) { showToast('Informe entre 1 e 20 aulas por dia', 'error'); return; }
        if (!Number.isFinite(diasDescansoPorSemana) || diasDescansoPorSemana < 0 || diasDescansoPorSemana > 6) { showToast('Informe entre 0 e 6 dias de descanso por semana', 'error'); return; }
        payload.aulasPorDia = aulasPorDia;
        payload.diasDescansoPorSemana = diasDescansoPorSemana;
    } else if (mode === 'data_prova') {
        var dataProva = document.getElementById('macro-data-prova').value;
        var hoje = new Date().toISOString().split('T')[0];
        if (!dataProva) { showToast('Informe a data da prova', 'error'); return; }
        if (dataProva < hoje) { showToast('A data da prova não pode estar no passado', 'error'); return; }
        payload.dataProva = dataProva;
    } else {
        showToast('Escolha como deseja criar o Plano Mestre', 'error');
        return;
    }
    var out = document.getElementById('macro-output');
    out.style.display = 'block';
    out.innerHTML = '<div class="plan-loading"><img src="/baron-reading-sm.png" style="width:56px;height:56px;border-radius:50%;animation:pulse 1.5s ease-in-out infinite" onerror="this.style.display=\'none\'"><p>Organizando 100% das aulas, os descansos e as revisões espaçadas…</p></div>';
    baronFloatPose('reading', 15000);
    API.generateMacroPlan(payload).then(function(plano) {
        renderMacroPlan(plano, out);
    }).catch(function(err) {
        out.innerHTML = '<div style="color:var(--danger);padding:20px;text-align:center"><i class="fas fa-exclamation-triangle"></i> ' + escapeHtml(err.message) + '</div>';
    });
}

function buildMateriaHtml(m) {
    var isRevisao = m.tipo === 'revisao';
    var isDone = !!m.done;
    var checkClass = isDone ? (isRevisao ? 'checked-rev' : 'checked') : '';
    var checkIcon = isDone ? '<i class="fas fa-check"></i>' : '';
    var itemId = m.id || '';
    var scheduledHtml = m.data
        ? '<div style="font-size:.8rem;color:var(--primary);margin-top:5px"><i class="fas fa-calendar-day" style="margin-right:5px"></i>Dia ' + (m.dia || '') + ' · ' + new Date(m.data + 'T12:00:00').toLocaleDateString('pt-BR') + '</div>'
        : '';

    var badge = '<span class="macro-badge ' + (isRevisao ? 'revisao' : 'estudo') + '">' +
        (isRevisao ? '<i class="fas fa-rotate-left" style="margin-right:3px"></i>Revisão espaçada' : '<i class="fas fa-book-open" style="margin-right:3px"></i>Estudo') + '</span>';

    var atvsHtml = '';
    if (!isRevisao) {
        atvsHtml = (m.atividades || []).map(function(a) {
            return '<div class="macro-atividade"><i class="fas fa-chevron-right"></i><span><strong>' + escapeHtml(a.tipo || '') + '</strong> — ' + escapeHtml(a.descricao || '') + (a.horas ? ' (' + a.horas + 'h)' : '') + '</span></div>';
        }).join('');
    }

    var linksHtml = '<div class="macro-links">';
    linksHtml += '<button class="macro-link-btn lesson" onclick="abrirAulasPlano(' + _jsNull(m.subject_id) + ',' + _jsNull(m.lesson_id) + ')" title="' + escapeHtml(m.lesson_title || 'Aula não vinculada') + '">' +
        '<i class="fas fa-play-circle"></i> Ver aulas</button>';
    linksHtml += '<button class="macro-link-btn exercise" onclick="abrirRevisaoPlano(' + _js(m.nome || '') + ')">' +
        (isRevisao ? '<i class="fas fa-pen-to-square"></i> Fazer exercícios' : '<i class="fas fa-question-circle"></i> Praticar questões') + '</button>';
    linksHtml += '</div>';

    return '<div class="macro-materia tipo-' + (isRevisao ? 'revisao' : 'estudo') + (isDone ? ' done-item' : '') + '" id="mitem-' + escapeHtml(itemId) + '">' +
        '<div class="macro-materia-header">' +
          '<div class="macro-check ' + checkClass + '" onclick="toggleMacraItem(' + _js(itemId) + ',' + !isDone + ')" title="Marcar como ' + (isDone ? 'não feito' : 'concluído') + '">' + checkIcon + '</div>' +
          '<div class="macro-materia-body">' +
            '<div class="macro-materia-name">' + escapeHtml(m.nome || '') + badge + '</div>' +
            (m.topico ? '<div class="macro-materia-topico">' + escapeHtml(m.topico) + '</div>' : '') +
            scheduledHtml +
            atvsHtml +
            (m.leituras ? '<div class="macro-leituras"><i class="fas fa-bookmark" style="margin-right:4px"></i>' + escapeHtml(m.leituras) + '</div>' : '') +
            linksHtml +
          '</div>' +
        '</div>' +
    '</div>';
}

function renderMacroPlan(plano, container) {
    var out = container || document.getElementById('macro-output');
    if (!out) return;
    var semanasHtml = (plano.semanas || []).map(function(s, i) {
        var materias = s.materias || [];
        var total = materias.length;
        var done = materias.filter(function(m){ return m.done; }).length;
        var progressStr = done + '/' + total + ' itens concluídos';
        var materiasHtml = materias.map(buildMateriaHtml).join('');
        var descansosHtml = (s.datasDescanso || []).length
            ? '<div style="margin:0 0 12px;padding:10px 14px;border-radius:var(--radius-md);background:var(--surface-hover);color:var(--text-secondary);font-size:.84rem"><i class="fas fa-mug-hot" style="color:var(--primary);margin-right:6px"></i>Descanso: ' + (s.datasDescanso || []).map(function(data) { return new Date(data + 'T12:00:00').toLocaleDateString('pt-BR'); }).join(', ') + '</div>'
            : '';
        var dateStr = s.dataInicio && s.dataFim
            ? ' <span style="font-size:.8rem;font-weight:400;color:var(--text-secondary)">' + escapeHtml(s.dataInicio) + ' – ' + escapeHtml(s.dataFim) + '</span>'
            : '';
        // Auto-open current week (check if today falls in this week)
        var isCurrentWeek = false;
        if (s.dataInicio && s.dataFim) {
            var now = new Date().toISOString().split('T')[0];
            isCurrentWeek = now >= s.dataInicio && now <= s.dataFim;
        }
        return '<div class="macro-semana">' +
            '<div class="macro-semana-header" onclick="toggleMacraSemana(this,' + i + ')">' +
              '<span><i class="fas fa-calendar-week" style="color:var(--primary);margin-right:8px"></i>Semana ' + (s.semana || (i+1)) + dateStr +
              '<span class="sem-progress">' + escapeHtml(progressStr) + '</span></span>' +
              '<i class="fas fa-chevron-down" style="color:var(--text-muted);transition:transform .2s"></i>' +
            '</div>' +
            '<div class="macro-semana-body' + (isCurrentWeek ? ' open' : '') + '" id="msb-' + i + '">' + descansosHtml + materiasHtml + '</div>' +
        '</div>';
    }).join('');

    var totalItems = 0, doneItems = 0;
    (plano.semanas || []).forEach(function(s) {
        (s.materias || []).forEach(function(m) { totalItems++; if (m.done) doneItems++; });
    });
    var pct = totalItems > 0 ? Math.round(doneItems / totalItems * 100) : 0;
    var isExamMode = plano.modoPlanejamento === 'data_prova';
    var examLabel = isExamMode && plano.dataProva ? new Date(plano.dataProva + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
    var fourthMetric = isExamMode
        ? '<div class="macro-metric"><span style="color:var(--text-secondary);font-size:.86rem"><i class="fas fa-calendar-check" style="color:var(--primary);margin-right:6px"></i>Data-alvo</span><strong>' + examLabel + '</strong></div>'
        : '<div class="macro-metric"><span style="color:var(--text-secondary);font-size:.86rem"><i class="fas fa-mug-hot" style="color:var(--primary);margin-right:6px"></i>Descanso</span><strong>' + (plano.diasDescansoPorSemana || 0) + ' por semana</strong></div>';

    out.innerHTML =
        '<div class="card macro-summary-card">' +
          '<div class="macro-art"><i class="fas fa-stamp"></i></div>' +
          '<div class="macro-summary-body">' +
            '<h2 style="font-size:1.7rem;margin-bottom:8px">Plano Mestre CACD</h2>' +
            '<p style="color:var(--text);max-width:760px">' + escapeHtml(plano.resumo || '') + '</p>' +
            '<div class="macro-metrics">' +
              '<div class="macro-metric"><span style="color:var(--text-secondary);font-size:.86rem"><i class="fas fa-stopwatch" style="color:var(--primary);margin-right:6px"></i>Aulas concluídas em</span><strong>' + (plano.totalDiasAulas || 0) + ' dias corridos</strong></div>' +
              '<div class="macro-metric"><span style="color:var(--text-secondary);font-size:.86rem"><i class="fas fa-film" style="color:var(--primary);margin-right:6px"></i>Cobertura</span><strong>' + (plano.totalAulas || totalItems) + ' aulas</strong></div>' +
              '<div class="macro-metric"><span style="color:var(--text-secondary);font-size:.86rem"><i class="fas fa-gauge-high" style="color:var(--primary);margin-right:6px"></i>Ritmo</span><strong>' + (isExamMode ? 'até ' : '') + (plano.aulasPorDia || 0) + ' por dia' + (isExamMode ? ' (calculado)' : '') + '</strong></div>' +
              fourthMetric +
              '<div class="macro-metric"><span style="color:var(--text-secondary);font-size:.86rem"><i class="fas fa-rotate-left" style="color:var(--primary);margin-right:6px"></i>Revisões</span><strong>' + (plano.totalRevisoes || 0) + ' em D+1, D+7 e D+30</strong></div>' +
              '<div class="macro-metric"><span style="color:var(--text-secondary);font-size:.86rem"><i class="fas fa-chart-line" style="color:var(--primary);margin-right:6px"></i>Progresso geral</span><strong>' + pct + '%</strong><div class="card-progress-bar" style="margin-top:6px"><div class="fill" style="width:' + pct + '%"></div></div></div>' +
              '<div class="macro-metric"><span style="color:var(--text-secondary);font-size:.86rem"><i class="fas fa-clipboard-check" style="color:var(--primary);margin-right:6px"></i>Itens concluídos</span><strong>' + doneItems + ' de ' + totalItems + '</strong></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:12px;flex-wrap:wrap;margin:18px 0 16px">' +
          '<span class="macro-badge estudo" style="padding:12px 22px"><i class="fas fa-play-circle"></i> Aulas <small style="font-weight:500;color:var(--text-secondary);margin-left:6px">100% do catálogo em ordem pedagógica</small></span>' +
          '<span class="macro-badge revisao" style="padding:12px 22px"><i class="fas fa-rotate-left"></i> Revisões espaçadas <small style="font-weight:500;color:var(--text-secondary);margin-left:6px">D+1, D+7 e D+30 após cada aula</small></span>' +
        '</div>' +
        semanasHtml;
}

function toggleMacraSemana(header, idx) {
    var body = document.getElementById('msb-' + idx);
    var icon = header.querySelector('i.fa-chevron-down,i.fa-chevron-up');
    if (!body) return;
    var open = body.classList.contains('open');
    body.classList.toggle('open', !open);
    if (icon) icon.style.transform = open ? '' : 'rotate(180deg)';
}

function toggleMacraItem(itemId, done) {
    if (!itemId) return;
    var el = document.getElementById('mitem-' + itemId);
    if (!el) return;
    var checkEl = el.querySelector('.macro-check');
    var isRevisao = el.classList.contains('tipo-revisao');
    if (done) {
        checkEl.className = 'macro-check ' + (isRevisao ? 'checked-rev' : 'checked');
        checkEl.innerHTML = '<i class="fas fa-check"></i>';
        el.classList.add('done-item');
    } else {
        checkEl.className = 'macro-check';
        checkEl.innerHTML = '';
        el.classList.remove('done-item');
    }
    // Update the onclick to reflect new state using safe single-quoted JS strings
    checkEl.setAttribute('onclick', 'toggleMacraItem(' + _js(itemId) + ',' + !done + ')');
    // Update all progress bars that reference this panel (both master-week-panel and macro-output)
    ['master-week-panel', 'macro-output'].forEach(function(panelId) {
        var panel = document.getElementById(panelId);
        if (!panel) return;
        var items = panel.querySelectorAll('.macro-materia');
        var total = items.length, doneCount = 0;
        items.forEach(function(item) { if (item.classList.contains('done-item')) doneCount++; });
        var pct = total > 0 ? Math.round(doneCount / total * 100) : 0;
        var bar = panel.querySelector('.fill[style*="width"]');
        if (bar) bar.style.width = pct + '%';
    });
    // Save to server (fire and forget)
    API.request('PUT', '/api/generate-macro-plan', { itemId: itemId, done: done }).catch(function() {});
}

function abrirAulasPlano(subjectId, lessonId) {
    if (subjectId && lessonId) {
        navigate('student-lesson', { subjectId: parseInt(subjectId, 10), lessonId: parseInt(lessonId, 10) });
        return;
    }
    showToast('Este item ainda não possui uma aula cadastrada', 'warning');
    if (subjectId) navigate('student-subject', { subjectId: subjectId });
}

function praticaTopico(subject, topic) {
    var existing = document.getElementById('pratica-topico-overlay');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'pratica-topico-overlay';
    overlay.className = 'review-modal-overlay';
    var title = topic || subject;
    overlay.innerHTML =
        '<div class="review-modal">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">' +
            '<h2 style="font-size:1.1rem"><i class="fas fa-dumbbell" style="color:var(--accent);margin-right:8px"></i>Praticar: ' + escapeHtml(title) + '</h2>' +
            '<button onclick="document.getElementById(\'pratica-topico-overlay\').remove()" style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--text-muted)">✕</button>' +
          '</div>' +
          '<div id="pratica-topico-body"><i class="fas fa-spinner fa-spin"></i> Carregando questões…</div>' +
        '</div>';
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    // Strip lesson code prefixes like "M1A1 - ", "Q3 - ", etc. and extract keywords
    function topicoKeyword(t) {
        if (!t) return null;
        // Remove "MXaX - " or "QX - " style prefixes
        var clean = t.replace(/^[A-Z]\d+[A-Z]?\d*\s*[-–]\s*/i, '').trim();
        // Take the most meaningful word (longest word > 4 chars)
        return clean || t;
    }
    var keyword = topicoKeyword(topic);

    function fetchQuestoes(searchTopic, fallbackSubject) {
        var url = '/api/questions?limit=10&source=exam';
        if (searchTopic) url += '&topic=' + encodeURIComponent(searchTopic);
        else url += '&subject=' + encodeURIComponent(fallbackSubject);
        return API.request('GET', url).then(function(data) {
            var qs = (data && data.questions) ? data.questions : [];
            // If no results with full keyword, try just the subject
            if (!qs.length && searchTopic && fallbackSubject) {
                return API.request('GET', '/api/questions?limit=10&source=exam&subject=' + encodeURIComponent(fallbackSubject))
                    .then(function(d) { return (d && d.questions) ? d.questions : []; });
            }
            return qs;
        });
    }

    fetchQuestoes(keyword, subject).then(function(qs) {
        var body = document.getElementById('pratica-topico-body');
        if (!body) return;
        if (!qs.length) {
            body.innerHTML = '<p style="color:var(--text-muted)">Nenhuma questão encontrada para este tópico ainda.</p>';
            return;
        }
        var _answers = {};
        body.innerHTML = '<div id="pratica-topico-qs">' + qs.map(function(q, qi) {
            var opts = q.opcoes || {};
            var optsHtml = Object.keys(opts).sort().map(function(k) {
                return '<label style="display:flex;align-items:flex-start;gap:10px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;cursor:pointer;margin-bottom:6px;font-size:.88rem" onclick="praticaResponder(\'' + q.id + '\',\'' + k + '\',\'' + (q.gabarito||'') + '\')" id="pratica-opt-' + q.id + '-' + k + '">' +
                    '<span style="font-weight:700;color:var(--primary);min-width:16px">' + k + ')</span>' +
                    '<span>' + escapeHtml(opts[k]) + '</span>' +
                '</label>';
            }).join('');
            return '<div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--border)">' +
                '<div style="font-size:.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">' + escapeHtml(q.subject || '') + (q.topic ? ' · ' + escapeHtml(q.topic) : '') + '</div>' +
                renderEnunciado(q.enunciado) +
                optsHtml +
                '<div id="pratica-exp-' + q.id + '" style="display:none;margin-top:8px;padding:8px 12px;background:var(--primary-light);border-radius:8px;font-size:.82rem"></div>' +
            '</div>';
        }).join('') + '</div>';
    }).catch(function(err) {
        var body = document.getElementById('pratica-topico-body');
        if (body) body.innerHTML = '<p style="color:var(--danger)">Erro: ' + escapeHtml(err.message) + '</p>';
    });
}


function normalizeAnswer(value) {
    var normalized = (value == null ? '' : String(value)).trim().toLowerCase();
    if (normalized === 'c' || normalized === 'certo') return 'a';
    if (normalized === 'e' || normalized === 'errado') return 'b';
    return normalized;
}

function answerLabel(value) {
    return normalizeAnswer(value) === 'a' ? 'Certo' : 'Errado';
}

function praticaResponder(questionId, chosen, gabarito) {
    chosen = normalizeAnswer(chosen);
    gabarito = normalizeAnswer(gabarito);
    var correct = chosen === gabarito;
    // Highlight options
    ['a','b','c','d','e'].forEach(function(k) {
        var el = document.getElementById('pratica-opt-' + questionId + '-' + k);
        if (!el) return;
        el.style.pointerEvents = 'none';
        if (k === gabarito) el.style.background = 'rgba(40,167,69,.15)', el.style.borderColor = 'var(--success)';
        else if (k === chosen && !correct) el.style.background = 'rgba(220,53,69,.1)', el.style.borderColor = 'var(--danger)';
    });
    var expEl = document.getElementById('pratica-exp-' + questionId);
    if (expEl) {
        expEl.style.display = 'block';
        expEl.innerHTML = correct
            ? '<span style="color:var(--success);font-weight:700">✓ Correto!</span>'
            : '<span style="color:var(--danger);font-weight:700">✗ Errado.</span> Resposta correta: <strong>' + answerLabel(gabarito) + '</strong>';
    }
    API.request('POST', '/api/questions', { action: 'record', subject: '', question_id: questionId, correct: correct }).catch(function(){});
}

function abrirRevisaoPlano(subjectName) {
    if (!subjectName) return;
    // Open practice modal for this subject
    var overlay = document.createElement('div');
    overlay.className = 'review-modal-overlay';
    overlay.id = 'review-modal-overlay';
    overlay.innerHTML = '<div class="review-modal">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">' +
          '<h2 style="font-size:1.15rem"><i class="fas fa-pen-to-square" style="color:var(--accent);margin-right:8px"></i>Revisão: ' + escapeHtml(subjectName) + '</h2>' +
          '<button onclick="document.getElementById(\'review-modal-overlay\').remove()" style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--text-muted)">✕</button>' +
        '</div>' +
        '<div id="review-modal-body"><i class="fas fa-spinner fa-spin"></i> Carregando questões de revisão…</div>' +
    '</div>';
    document.body.appendChild(overlay);

    API.request('GET', '/api/questions?subject=' + encodeURIComponent(subjectName) + '&source=exam&limit=10').then(function(data) {
        var qs = (data && data.questions) || [];
        var body = document.getElementById('review-modal-body');
        if (!body) return;
        if (qs.length === 0) {
            body.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted)">' +
                '<i class="fas fa-database" style="font-size:2rem;margin-bottom:12px"></i>' +
                '<p>Ainda não há questões de prova nesta matéria no banco.</p>' +
                '<p style="font-size:.85rem;margin-top:8px">As questões do CACD TPS 2023+ estão sendo carregadas progressivamente. Em breve haverá mais questões disponíveis.</p>' +
            '</div>';
            return;
        }
        var html = '<div style="font-size:.82rem;color:var(--text-muted);margin-bottom:16px">' + qs.length + ' questões de prova real (CACD TPS) • Julgue cada item como Certo ou Errado</div>';
        qs.forEach(function(q, qi) {
            var qId = 'rev-q-' + qi;
            html += '<div style="margin-bottom:20px;padding:16px;background:var(--surface-hover);border-radius:var(--radius-md);border:1px solid var(--border)">' +
                '<div style="font-size:.82rem;color:var(--accent);font-weight:600;margin-bottom:8px">QUESTÃO ' + (qi + 1) + ' · ' + escapeHtml(q.subject || '') + '</div>' +
                renderEnunciado(q.enunciado) +
                '<div style="display:flex;gap:10px">' +
                  '<button type="button" class="btn btn-secondary btn-sm review-answer-btn" id="' + qId + '-a" data-qid="' + escapeHtml(qId) + '" data-question-id="' + escapeHtml(q.id || '') + '" data-gabarito="' + escapeHtml(q.gabarito || '') + '" data-subject="' + escapeHtml(subjectName || '') + '" data-answer="a">Certo</button>' +
                  '<button type="button" class="btn btn-secondary btn-sm review-answer-btn" id="' + qId + '-b" data-qid="' + escapeHtml(qId) + '" data-question-id="' + escapeHtml(q.id || '') + '" data-gabarito="' + escapeHtml(q.gabarito || '') + '" data-subject="' + escapeHtml(subjectName || '') + '" data-answer="b">Errado</button>' +
                '</div>' +
                '<div id="' + qId + '-result" style="margin-top:10px;font-size:.85rem;display:none"></div>' +
                (q.explicacao ? '<div id="' + qId + '-exp" style="display:none;margin-top:8px;padding:10px;background:var(--primary-light);border-radius:var(--radius-sm);font-size:.83rem">' + escapeHtml(q.explicacao) + '</div>' : '') +
            '</div>';
        });
        body.innerHTML = html;
        body.onclick = function(e) {
            var btn = e.target.closest('.review-answer-btn');
            if (!btn || !body.contains(btn)) return;
            conferirRevisao(btn.dataset.qid, btn.dataset.questionId, btn.dataset.gabarito, btn.dataset.subject, btn.dataset.answer);
        };
    }).catch(function() {
        var body = document.getElementById('review-modal-body');
        if (body) body.innerHTML = '<p style="color:var(--danger)">Erro ao carregar questões.</p>';
    });
}

function conferirRevisao(qId, questionId, gabarito, subjectName, answer) {
    gabarito = normalizeAnswer(gabarito);
    answer = normalizeAnswer(answer);
    var correct = answer === gabarito;
    var resultEl = document.getElementById(qId + '-result');
    var expEl = document.getElementById(qId + '-exp');
    var btnA = document.getElementById(qId + '-a');
    var btnB = document.getElementById(qId + '-b');
    if (btnA) btnA.disabled = true;
    if (btnB) btnB.disabled = true;
    if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.innerHTML = correct
            ? '<span style="color:var(--success);font-weight:700"><i class="fas fa-check-circle"></i> Correto! ' + answerLabel(gabarito) + '</span>'
            : '<span style="color:var(--danger);font-weight:700"><i class="fas fa-times-circle"></i> Incorreto. A resposta é ' + answerLabel(gabarito) + '</span>';
    }
    if (expEl) expEl.style.display = 'block';
    API.request('POST', '/api/questions', { action: 'record', subject: subjectName, question_id: questionId || null, correct: correct }).catch(function(){});
}

/* ============================================================
   VIEW: STUDENT PERFORMANCE
   ============================================================ */
function renderStudentPerformance() {
    var app = document.getElementById('app');
    var nav = renderNavbar(studentNav());
    app.innerHTML = nav + '<div class="container"><div class="page-content">' +
        zenHero('Barão — Seu Coach Diplomático', 'Acompanhe seu desempenho por matéria e foque nas áreas que precisam de mais atenção para evoluir com estratégia e constância.', '/baron-pointing-sm.png') +
        '<div class="loading-spinner" id="perf-area"><i class="fas fa-spinner"></i> Carregando desempenho...</div>' +
        '</div></div>';

    Promise.all([
        API.request('GET', '/api/performance'),
        API.request('GET', '/api/performance?action=macro'),
        API.request('GET', '/api/performance?action=study')
    ]).then(function(results) {
        var data = results[0];
        var macro = results[1];
        var sessions = results[2] || [];
        var area = document.getElementById('perf-area');
        if (!area) return;

        var overall = data.overall || { total: 0, correct: 0, accuracy: 0 };
        var subjects = data.subjects || [];
        var weakSubjects = data.weakSubjects || [];
        var weakTopics = data.weakTopics || [];

        // Overall stats card
        var perfColor = overall.accuracy >= 70 ? 'var(--primary)' : overall.accuracy >= 50 ? 'var(--accent)' : 'var(--jade-soft)';
        var overallHtml = '<h2 class="section-title"><i class="fas fa-chart-pie"></i>Estatísticas Gerais</h2><div class="zen-stats-grid">' +
            '<div class="card stat-card"><div class="stat-card-inner"><div class="stat-icon"><i class="fas fa-clipboard-check"></i></div><div><div class="stat-value">' + overall.total + '</div><div class="stat-label">Questões Respondidas</div></div></div><div class="perf-bar"><div class="perf-bar-fill" style="width:' + (overall.total ? 100 : 0) + '%"></div></div><div style="font-size:.82rem;color:var(--text-muted)">' + overall.correct + ' acertos de ' + overall.total + ' questões</div></div>' +
            '<div class="card stat-card"><div class="stat-card-inner"><div class="stat-icon"><i class="fas fa-bullseye"></i></div><div><div class="stat-value" style="color:' + perfColor + '">' + overall.accuracy + '%</div><div class="stat-label">Aproveitamento Geral</div></div></div><div class="perf-bar"><div class="perf-bar-fill" style="width:' + overall.accuracy + '%;background:' + perfColor + '"></div></div><div style="font-size:.82rem;color:var(--text-muted)">' + overall.correct + ' acertos de ' + overall.total + ' questões</div></div>' +
            '<div class="card stat-card"><div class="stat-card-inner"><div class="stat-icon"><i class="fas fa-book-open"></i></div><div><div class="stat-value">' + overall.subjects_with_data + '</div><div class="stat-label">Matérias Praticadas</div></div></div><div class="perf-bar"><div class="perf-bar-fill" style="width:' + Math.min(100, (overall.subjects_with_data || 0) / 9 * 100) + '%"></div></div><div style="font-size:.82rem;color:var(--text-muted)">' + (overall.subjects_with_data || 0) + ' de 9 matérias praticadas</div></div>' +
        '</div>';

        // Baron recommendation
        var baronPose = overall.accuracy >= 70 ? 'baron-thumbsup-sm.png' : 'baron-thinking-sm.png';
        var recMsg = '';
        if (overall.total === 0) {
            recMsg = '<h3>Comece a praticar!</h3><p>Você ainda não respondeu nenhuma questão. Acesse uma aula e pratique questões para ver seu desempenho aqui.</p>';
        } else if (weakTopics.length > 0) {
            var rt = weakTopics[0];
            recMsg = '<h3>Foco recomendado: ' + escapeHtml(rt.topic) + '</h3><p>Seu aproveitamento em <strong>' + escapeHtml(rt.topic) + '</strong> (' + escapeHtml(rt.subject) + ') está em ' + rt.accuracy + '%. O Barão recomenda intensificar a prática neste tópico.</p>';
        } else if (weakSubjects.length > 0) {
            recMsg = '<h3>Foco recomendado: ' + escapeHtml(weakSubjects[0].subject) + '</h3><p>Seu aproveitamento em ' + escapeHtml(weakSubjects[0].subject) + ' está em ' + weakSubjects[0].accuracy + '%. O Barão recomenda intensificar a prática nesta matéria antes da prova.</p>';
        } else {
            recMsg = '<h3>Excelente desempenho!</h3><p>Todas as suas matérias estão com aproveitamento acima de 60%. Continue praticando para manter o ritmo!</p>';
        }
        var baronRecommendHtml = '<div class="baron-recommend" style="margin-top:22px">' +
            '<img src="/' + baronPose + '" style="width:88px;height:88px;border-radius:50%;flex-shrink:0;border:4px solid rgba(255,255,255,.85);box-shadow:var(--shadow-sm)" onerror="this.style.display=\'none\'">' +
            '<div class="baron-rec-msg">' + recMsg + '</div>' +
        '</div>';

        // Per-subject table
        var subjectsHtml = '<div class="perf-card">' +
            '<h3 style="margin-bottom:16px"><i class="fas fa-book-open" style="color:var(--primary);margin-right:8px"></i>Desempenho por Matéria</h3>';
        if (subjects.length === 0) {
            subjectsHtml += '<p style="color:var(--text-muted);font-size:.9rem">Nenhuma questão respondida ainda. Pratique questões nas aulas para ver seu desempenho aqui.</p>';
        } else {
            subjectsHtml += subjects.sort(function(a,b){return a.accuracy - b.accuracy;}).map(function(s) {
                var color = s.accuracy >= 70 ? 'var(--primary)' : s.accuracy >= 50 ? 'var(--accent)' : 'var(--jade-soft)';
                return '<div class="subject-perf-row">' +
                    '<div class="subject-perf-name">' + escapeHtml(s.subject) + '</div>' +
                    '<div class="subject-perf-bar-wrap">' +
                      '<div class="perf-bar"><div class="perf-bar-fill" style="width:' + s.accuracy + '%;background:' + color + '"></div></div>' +
                    '</div>' +
                    '<div class="subject-perf-stats">' + s.accuracy + '% &nbsp;·&nbsp; ' + s.correct + '/' + s.total + '</div>' +
                '</div>';
            }).join('');
        }
        subjectsHtml += '</div>';

        // Plano Mestre progress
        var macroHtml = '<div class="perf-card">' +
            '<h3 style="margin-bottom:12px"><i class="fas fa-road" style="color:var(--accent);margin-right:8px"></i>Plano Mestre</h3>';
        if (macro && macro.plan_json) {
            var performanceExamDate = macro.plan_json.modoPlanejamento === 'data_prova' ? macro.plan_json.dataProva : null;
            var provaDate = performanceExamDate ? new Date(performanceExamDate + 'T12:00:00') : null;
            var planStatusText;
            if (provaDate) {
                var daysLeft = Math.max(0, Math.ceil((provaDate - new Date()) / (1000 * 60 * 60 * 24)));
                planStatusText = 'Data da prova: <strong>' + provaDate.toLocaleDateString('pt-BR') + '</strong> — <strong style="color:' + (daysLeft > 30 ? 'var(--primary)' : 'var(--accent)') + '">' + daysLeft + ' dias restantes</strong>';
            } else {
                planStatusText = 'Ritmo: <strong>' + (macro.plan_json.aulasPorDia || 0) + ' aula(s) por dia</strong> · <strong>' + (macro.plan_json.diasDescansoPorSemana || 0) + ' descanso(s) por semana</strong>';
            }
            macroHtml += '<div style="font-size:.92rem;margin-bottom:12px">' + planStatusText + '</div>' +
                '<button class="btn btn-secondary btn-sm" onclick="navigate(\'student-macro-planner\')"><i class="fas fa-road"></i> Ver Plano Mestre</button>';
        } else {
            macroHtml += '<p style="color:var(--text-muted);font-size:.9rem;margin-bottom:12px">Você ainda não criou seu Plano Mestre de estudos.</p>' +
                '<button class="btn btn-primary btn-sm" onclick="navigate(\'student-macro-planner\')"><i class="fas fa-magic"></i> Crie seu Plano Mestre</button>';
        }
        macroHtml += '</div>';

        // Weak spots with practice buttons (by topic)
        var weakHtml = '';
        var weakList = weakTopics.length > 0 ? weakTopics : weakSubjects.slice(0, 10).map(function(s) { return { subject: s.subject, topic: null, accuracy: s.accuracy, correct: s.correct, total: s.total }; });
        if (weakList.length > 0) {
            weakHtml = '<div class="perf-card">' +
                '<h3 style="margin-bottom:12px"><i class="fas fa-compass" style="color:var(--accent);margin-right:8px"></i>Focos de Aperfeiçoamento — Top ' + weakList.length + '</h3>';
            weakHtml += weakList.map(function(t) {
                var label = t.topic || t.subject;
                var sub = t.topic ? t.subject : '';
                var onclickArg = t.topic ? ('praticaTopico(' + _js(t.subject) + ',' + _js(t.topic) + ')') : ('praticaTopico(' + _js(t.subject) + ',null)');
                return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">' +
                    '<div>' +
                      '<div style="font-weight:600;font-size:.92rem">' + escapeHtml(label) + '</div>' +
                      (sub ? '<div style="font-size:.75rem;color:var(--text-muted);margin-bottom:2px">' + escapeHtml(sub) + '</div>' : '') +
                      '<div style="font-size:.8rem;color:var(--accent)">' + t.accuracy + '% aproveitamento (' + t.correct + '/' + t.total + ')</div>' +
                    '</div>' +
                    '<button class="btn btn-sm btn-accent" onclick="' + onclickArg + '">' +
                      '<i class="fas fa-dumbbell"></i> Praticar agora' +
                    '</button>' +
                '</div>';
            }).join('');
            weakHtml += '</div>';
        }

        // Study sessions card
        var studyHtml = '<div class="perf-card zen-study-bar"><div><h3 style="font-size:1.35rem;margin-bottom:4px"><i class="fas fa-torii-gate" style="color:var(--accent);margin-right:8px"></i>Sessão de Estudo</h3><p style="font-size:.86rem;color:var(--text-secondary);margin:0">Mantenha o foco e avance com disciplina.</p></div>';
        if (!sessions || sessions.length === 0) {
            studyHtml += '<div class="study-clock">00:00:00</div><button class="btn btn-primary" onclick="openStudyTimer()" style="justify-content:center"><i class="fas fa-play"></i> Iniciar sessão</button><button class="btn btn-secondary" onclick="openStudyTimer()" title="Configurar sessão"><i class="fas fa-gear"></i></button>';
        } else {
            var bySubject = {};
            sessions.forEach(function(s) {
                bySubject[s.subject] = (bySubject[s.subject] || 0) + s.duration_minutes;
            });
            var totalMin = sessions.reduce(function(acc, s) { return acc + s.duration_minutes; }, 0);
            studyHtml += '<div><div class="study-clock">' + Math.floor(totalMin/60) + 'h ' + (totalMin%60) + 'min</div><div style="font-size:.82rem;color:var(--text-muted);text-align:center">' + sessions.length + ' sessões registradas</div></div><button class="btn btn-primary" onclick="openStudyTimer()" style="justify-content:center"><i class="fas fa-play"></i> Iniciar sessão</button><button class="btn btn-secondary" onclick="openStudyTimer()" title="Configurar sessão"><i class="fas fa-gear"></i></button></div><div class="perf-card">';
            studyHtml += '<h3 style="margin-bottom:12px">Tempo por matéria</h3>' + Object.entries(bySubject).sort(function(a,b){return b[1]-a[1];}).map(function(e) {
                var min = e[1];
                return '<div class="subject-perf-row"><div class="subject-perf-name">' + escapeHtml(e[0]) + '</div>' +
                    '<div style="font-size:.85rem;color:var(--text-muted)">' + Math.floor(min/60) + 'h ' + (min%60) + 'min</div></div>';
            }).join('');
            studyHtml += '<details style="margin-top:12px"><summary style="font-size:.85rem;color:var(--text-muted);cursor:pointer">Ver histórico de sessões</summary>' +
                '<div style="margin-top:8px;font-size:.82rem">' + sessions.slice(0,10).map(function(s) {
                    return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">' +
                        '<span>' + escapeHtml(s.subject) + '</span>' +
                        '<span style="color:var(--text-muted)">' + s.duration_minutes + ' min · ' + new Date(s.started_at).toLocaleDateString('pt-BR') + '</span></div>';
                }).join('') + '</div></details>';
        }
        studyHtml += '</div>';

        area.className = '';
        area.innerHTML = overallHtml + '<div class="zen-two-col" style="margin-top:22px">' + baronRecommendHtml + macroHtml + '</div>' + studyHtml + subjectsHtml + weakHtml;
    }).catch(function(err) {
        var area = document.getElementById('perf-area');
        if (area) area.innerHTML = '<div style="color:var(--danger);padding:20px;text-align:center"><i class="fas fa-exclamation-triangle"></i> ' + escapeHtml(err.message) + '</div>';
    });
}

/* ============================================================
   EVENT HANDLERS
   ============================================================ */
function handleLogout() { API.clearToken(); state.user=null; state.view='login'; render(); }
function handleAddSubject() {
    showFormModal('Nova Matéria',[{name:'name',label:'Nome',placeholder:'Ex: Matemática',required:true},{name:'description',label:'Descrição',type:'textarea',placeholder:'Descreva...'}],'Criar',function(v) {
        if(!v.name.trim()){showToast('Nome obrigatório','error');return;}
        API.createSubject({name:v.name.trim(),description:v.description.trim()}).then(function(){showToast('Matéria criada!');render();}).catch(function(e){showToast(e.message,'error');});
    });
}
function handleEditSubject(id, name, desc) {
    showFormModal('Editar Matéria',[{name:'name',label:'Nome',value:name,required:true},{name:'description',label:'Descrição',type:'textarea',value:desc}],'Salvar',function(v) {
        API.updateSubject(id,{name:v.name.trim(),description:v.description.trim()}).then(function(){showToast('Atualizada!');render();}).catch(function(e){showToast(e.message,'error');});
    });
}
function handleDeleteSubject(id, name) {
    showConfirmModal('Excluir Matéria','Excluir "'+name+'"? Todas as aulas serão removidas.','Excluir','btn-danger',function() {
        API.deleteSubject(id).then(function(){showToast('Excluída');render();}).catch(function(e){showToast(e.message,'error');});
    });
}
function handleReorderLesson(id, dir) {
    API.reorderLesson(id, dir).then(function() { render(); }).catch(function(e) { showToast(e.message,'error'); });
}
function handleEditLessonApi(id) {
    API.getLessons(state.selectedSubjectId).then(function(lessons) {
        var l = lessons.find(function(x){return x.id===id;});
        if(!l) return;
        showFormModal('Editar Aula',[{name:'title',label:'Título',value:l.title,required:true},{name:'drive_url',label:'Link Google Drive',type:'url',value:l.drive_url},{name:'duration_minutes',label:'Duração (min)',type:'number',value:String(l.duration_minutes)}],'Salvar',function(v) {
            API.updateLesson(id,{title:v.title.trim(),drive_url:v.drive_url.trim(),duration_minutes:parseInt(v.duration_minutes,10)||0}).then(function(){showToast('Aula atualizada');render();}).catch(function(e){showToast(e.message,'error');});
        });
    });
}
function handleDeleteLessonApi(id, title) {
    showConfirmModal('Excluir Aula','Excluir "'+title+'"?','Excluir','btn-danger',function() {
        API.deleteLesson(id).then(function(){showToast('Aula excluída');render();}).catch(function(e){showToast(e.message,'error');});
    });
}
function handleAddUser() {
    showFormModal('Novo Usuário',[{name:'name',label:'Nome Completo',placeholder:'Ex: Ana Oliveira',required:true},{name:'username',label:'Usuário (login)',placeholder:'Ex: ana.oliveira',required:true},{name:'password',label:'Senha',placeholder:'Mín. 4 caracteres',required:true},{name:'role',label:'Perfil',type:'select',value:'student',options:[{value:'student',label:'Aluno'},{value:'admin',label:'Administrador'}]}],'Criar Usuário',function(v) {
        if(!v.name.trim()||!v.username.trim()){showToast('Preencha todos os campos','error');return;}
        if(v.password.length<4){showToast('Senha mín. 4 caracteres','error');return;}
        API.createUser({name:v.name.trim(),username:v.username.trim(),password:v.password,role:v.role}).then(function(){showToast('Usuário criado!');render();}).catch(function(e){showToast(e.message,'error');});
    });
}
function handleEditUserApi(id) {
    API.getUsers().then(function(users) {
        var u = users.find(function(x){return x.id===id;});
        if(!u) return;
        showFormModal('Editar Usuário',[{name:'name',label:'Nome',value:u.name,required:true},{name:'username',label:'Usuário',value:u.username,required:true},{name:'password',label:'Nova Senha (vazio = manter)',placeholder:'Deixe vazio para manter'},{name:'role',label:'Perfil',type:'select',value:u.role,options:[{value:'student',label:'Aluno'},{value:'admin',label:'Administrador'}]}],'Salvar',function(v) {
            var data = {name:v.name.trim(),username:v.username.trim(),role:v.role};
            if(v.password) data.password = v.password;
            API.updateUser(id,data).then(function(){showToast('Usuário atualizado');render();}).catch(function(e){showToast(e.message,'error');});
        });
    });
}
function handleDeleteUserApi(id, name) {
    showConfirmModal('Excluir Usuário','Excluir "'+name+'"?','Excluir','btn-danger',function() {
        API.deleteUser(id).then(function(){showToast('Excluído');render();}).catch(function(e){showToast(e.message,'error');});
    });
}

/* ============================================================
   MAIN RENDER
   ============================================================ */
function render() {
    var floatBtn = document.getElementById('baron-float');
    if (floatBtn) floatBtn.style.display = (state.user && state.view !== 'login' && state.view !== 'reset') ? 'block' : 'none';
    switch (state.view) {
        case 'login':             renderLoginView(); break;
        case 'reset':             renderResetView(); break;
        case 'admin-dashboard':   renderAdminDashboard(); break;
        case 'admin-subject':     renderAdminSubject(); break;
        case 'admin-users':       renderAdminUsers(); break;
        case 'admin-schema':      renderAdminSchema(); break;
        case 'student-planner':   renderStudentPlanner(); break;
        case 'student-dashboard': renderStudentDashboard(); break;
        case 'student-subject':   renderStudentSubject(); break;
        case 'student-lesson':         renderStudentLesson(); break;
        case 'student-macro-planner':  renderStudentMacroPlan(); break;
        case 'student-simulado':       renderStudentSimulado(); break;
        case 'student-performance':    renderStudentPerformance(); break;
        default:                       renderLoginView();
    }
}
function renderLoginView() {
    document.getElementById('app').innerHTML = renderLogin();
    bindLogin();
}
function renderResetView() {
    document.getElementById('app').innerHTML = renderResetPassword();
    bindResetPassword();
}

/* ============================================================
   INITIALIZATION — check for saved token
   ============================================================ */
(function init() {
    var urlParams = new URLSearchParams(window.location.search);
    var resetToken = urlParams.get('reset');

    if (resetToken) {
        API.clearToken();
        state.resetToken = resetToken;
        navigate('reset');
        return;
    }

    var token = API.getToken();
    if (token) {
        API.getMe().then(function(data) {
            state.user = data.user;
            navigate(data.user.role === 'admin' ? 'admin-dashboard' : 'student-dashboard');
        }).catch(function() {
            API.clearToken();
            render();
        });
    } else {
        render();
    }
})();
