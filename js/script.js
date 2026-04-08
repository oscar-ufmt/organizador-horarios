let disciplinas = [];
let grade = JSON.parse(localStorage.getItem('grade_horarios_ufmt')) || {};
let discSelecionada = null;

const horarios = [
    { id: "M1", label: "07:30 - 09:30" },
    { id: "M2", label: "09:30 - 11:30" },
    { id: "T1", label: "13:30 - 15:30" },
    { id: "T2", label: "15:30 - 17:30" }
];
const dias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

async function carregarDados() {
    try {
        const res = await fetch('./data/disciplinas_obrigatorias.json?v=' + Date.now());
        disciplinas = await res.json();
        const selSem = document.getElementById('filtroSemestre');
        for(let i=1; i<=10; i++) {
            let opt = document.createElement('option');
            opt.value = i; opt.textContent = i + "º Semestre";
            selSem.appendChild(opt);
        }
        renderizarGrade();
        carregarDisciplinas();
    } catch (e) { alert("Erro ao carregar banco de dados."); }
}

function carregarDisciplinas() {
    const ppc = document.getElementById('filtroPPC').value;
    const semestre = document.getElementById('filtroSemestre').value;
    const container = document.getElementById('listaDisciplinas');
    container.innerHTML = '';
    disciplinas.filter(d => d[`ppc_${ppc}`] == semestre).forEach(d => {
        const div = document.createElement('div');
        div.className = `card-disc-item ${discSelecionada?.codigo === d.codigo ? 'active' : ''}`;
        div.innerHTML = `<div class="disc-info"><strong>${d.codigo}</strong><span>${d.nome}</span></div>`;
        div.onclick = () => selecionarDisciplina(d);
        container.appendChild(div);
    });
}

function selecionarDisciplina(d) {
    discSelecionada = d;
    document.getElementById('formConfig').style.display = 'block';
    document.getElementById('nomeDiscSelecionada').innerText = d.nome;

    // Sugestão inicial baseada na carga horária
    const totalEncontros = parseInt(d.carga_horaria) / 32;
    document.getElementById('metaT').value = 1;
    document.getElementById('metaP').value = Math.max(0, totalEncontros - 1);

    atualizarStatusCarga();
    carregarDisciplinas();
}

function atualizarStatusCarga() {
    if (!discSelecionada) return;
    const metaT = parseInt(document.getElementById('metaT').value) || 0;
    const metaP = parseInt(document.getElementById('metaP').value) || 0;

    // CONTAGEM GLOBAL: Ignora a etiqueta da turma, foca no código da disciplina
    const aulasGlobal = Object.values(grade).flat().filter(a => a.codigo === discSelecionada.codigo);

    const atualT = aulasGlobal.filter(a => a.tipo === 'Teórica').length;
    const atualP = aulasGlobal.filter(a => a.tipo !== 'Teórica').length;

    document.getElementById('countT').innerText = `${atualT}/${metaT}`;
    document.getElementById('countP').innerText = `${atualP}/${metaP}`;

    document.getElementById('countT').style.color = atualT >= metaT ? 'var(--success)' : '#ef4444';
    document.getElementById('countP').style.color = atualP >= metaP ? 'var(--success)' : '#ef4444';
}

function alocarNaGrade(dia, horaId) {
    if (!discSelecionada) return alert("Selecione uma disciplina primeiro.");

    const tipo = document.getElementById('tipoAula').value;
    const turma = document.getElementById('turmaId').value.trim().toUpperCase() || "A";
    const prof = document.getElementById('profNome').value || "A definir";
    const semestre = document.getElementById('filtroSemestre').value;
    const ppc = document.getElementById('filtroPPC').value;

    const metaT = parseInt(document.getElementById('metaT').value) || 0;
    const metaP = parseInt(document.getElementById('metaP').value) || 0;

    // 1. VALIDAÇÃO DE LIMITE GLOBAL DA DISCIPLINA
    const aulasGlobal = Object.values(grade).flat().filter(a => a.codigo === discSelecionada.codigo);
    const atualT = aulasGlobal.filter(a => a.tipo === 'Teórica').length;
    const atualP = aulasGlobal.filter(a => a.tipo !== 'Teórica').length;

    if (tipo === 'Teórica' && atualT >= metaT) {
        return alert(`Limite GLOBAL de aulas Teóricas atingido (${metaT}).`);
    }
    if (tipo !== 'Teórica' && atualP >= metaP) {
        return alert(`Limite GLOBAL de aulas Práticas atingido (${metaP}).`);
    }

    const cellId = `${dia}-${horaId}`;
    if (!grade[cellId]) grade[cellId] = [];

    // 2. VERIFICAÇÃO DE CHOQUES
    const todosAulas = Object.values(grade).flat();

    // Professor já ocupado neste horário?
    if (prof !== "A definir" && todosAulas.some(a => a.dia === dia && a.horaId === horaId && a.prof === prof))
        return alert(`CHOQUE: O prof. ${prof} já tem aula neste horário.`);

    // Turma X desta disciplina já está neste horário?
    if (grade[cellId].some(a => a.codigo === discSelecionada.codigo && a.turma === turma))
        return alert(`CHOQUE: A Turma ${turma} já possui atividade neste horário.`);

    // Conflito Pedagógico: Duas disciplinas diferentes do mesmo semestre/PPC
    if (grade[cellId].some(a => a.semestre === semestre && a.ppc === ppc && a.codigo !== discSelecionada.codigo))
        return alert(`CONFLITO PEDAGÓGICO: O ${semestre}º Semestre já possui outra disciplina neste horário.`);

    grade[cellId].push({
        codigo: discSelecionada.codigo, nome: discSelecionada.nome,
        turma, tipo, prof, sala: document.getElementById('salaAula').value || "S/I",
        semestre, ppc, dia, horaId
    });

    localStorage.setItem('grade_horarios_ufmt', JSON.stringify(grade));
    renderizarGrade();
    atualizarStatusCarga();
}

function renderizarGrade() {
    const corpo = document.getElementById('corpoTabela');
    corpo.innerHTML = '';
    horarios.forEach(h => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="hora-label"><strong>${h.label}</strong></td>`;
        dias.forEach(dia => {
            const cellId = `${dia}-${h.id}`;
            const td = document.createElement('td');
            td.className = "celula-horario";
            const container = document.createElement('div');
            container.className = "container-cards";

            if (grade[cellId]) {
                grade[cellId].forEach((aula, idx) => {
                    const card = document.createElement('div');
                    card.className = `aula-box semestre-${aula.semestre}`;
                    card.innerHTML = `
                        <div class="tipo-badge">${aula.tipo[0]}</div>
                        <div class="turma-tag">${aula.turma}</div>
                        <strong>${aula.codigo}</strong>
                        <div class="disc-nome">${aula.nome}</div>
                        <small>👤 ${aula.prof}</small>
                        <small>📍 ${aula.sala}</small>
                        <button class="btn-del" onclick="removerAula('${cellId}', ${idx})">×</button>
                    `;
                    container.appendChild(card);
                });
            }
            const btnAdd = document.createElement('button');
            btnAdd.className = "btn-adicionar-vaga"; btnAdd.innerHTML = "+";
            btnAdd.onclick = () => alocarNaGrade(dia, h.id);
            td.appendChild(container); td.appendChild(btnAdd); tr.appendChild(td);
        });
        corpo.appendChild(tr);
    });
}

function removerAula(cellId, idx) {
    grade[cellId].splice(idx, 1);
    if (grade[cellId].length === 0) delete grade[cellId];
    localStorage.setItem('grade_horarios_ufmt', JSON.stringify(grade));
    renderizarGrade();
    atualizarStatusCarga();
}

function limparGrade() { if(confirm("Deseja resetar toda a grade?")) { localStorage.clear(); location.reload(); } }

carregarDados();