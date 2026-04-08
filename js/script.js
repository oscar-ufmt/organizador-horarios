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
        salvarEAtualizar();
    } catch (e) { alert("Erro ao carregar banco de dados."); }
}

function carregarDisciplinas() {
    const ppc = document.getElementById('filtroPPC').value;
    const semestre = document.getElementById('filtroSemestre').value;
    const container = document.getElementById('listaDisciplinas');
    container.innerHTML = '';

    disciplinas.filter(d => d[`ppc_${ppc}`] == semestre).forEach(d => {
        const slotsAlocados = Object.values(grade).flat().filter(a => a.codigo === d.codigo).length;
        const slotsNecessarios = Math.ceil(parseInt(d.carga_horaria) / 32);
        const concluida = slotsAlocados >= slotsNecessarios;

        const div = document.createElement('div');
        div.className = `card-disc-item ${discSelecionada?.codigo === d.codigo ? 'active' : ''} ${concluida ? 'concluida' : ''}`;
        div.innerHTML = `
            <div class="disc-info">
                <strong>${concluida ? '✅ ' : ''}${d.codigo}</strong>
                <span>${d.nome}</span>
            </div>
            <span class="badge-ch">${d.carga_horaria}</span>
        `;
        div.onclick = () => selecionarDisciplina(d);
        container.appendChild(div);
    });
}

function selecionarDisciplina(d) {
    discSelecionada = d;
    document.getElementById('formConfig').style.display = 'block';
    document.getElementById('nomeDiscSelecionada').innerText = d.nome;
    document.getElementById('cargaHorariaInfo').innerText = `Carga Horária: ${d.carga_horaria}`;

    const totalEncontros = parseInt(d.carga_horaria) / 32;
    document.getElementById('metaT').value = 1;
    document.getElementById('metaP').value = Math.max(0, totalEncontros - 1);

    salvarEAtualizar();
}

function atualizarStatusCarga() {
    if (!discSelecionada) return;
    const metaT = parseInt(document.getElementById('metaT').value) || 0;
    const metaP = parseInt(document.getElementById('metaP').value) || 0;
    const metaTotal = metaT + metaP;

    const aulasGlobal = Object.values(grade).flat().filter(a => a.codigo === discSelecionada.codigo);
    const atualT = aulasGlobal.filter(a => a.tipo === 'Teórica').length;
    const atualP = aulasGlobal.filter(a => a.tipo !== 'Teórica').length;
    const atualTotal = atualT + atualP;

    document.getElementById('countT').innerText = `${atualT}/${metaT}`;
    document.getElementById('countP').innerText = `${atualP}/${metaP}`;

    const alerta = document.getElementById('alertaHorario');
    if (atualTotal < metaTotal) {
        alerta.innerHTML = `<div class="alerta-aviso">⚠️ Faltam alocar ${metaTotal - atualTotal} encontro(s).</div>`;
    } else if (atualTotal === metaTotal) {
        alerta.innerHTML = `<div class="alerta-sucesso">✅ Carga horária completa!</div>`;
    } else {
        alerta.innerHTML = `<div class="alerta-perigo">❌ Excesso de carga (${atualTotal}/${metaTotal}).</div>`;
    }

    // Cores dinâmicas nos contadores
    document.getElementById('countT').style.color = (atualT > metaT) ? 'red' : (atualT === metaT ? 'var(--success)' : 'white');
    document.getElementById('countP').style.color = (atualP > metaP) ? 'red' : (atualP === metaP ? 'var(--success)' : 'white');
}

function alocarNaGrade(dia, horaId) {
    if (!discSelecionada) return alert("Selecione uma disciplina primeiro.");

    const tipo = document.getElementById('tipoAula').value; // Teórica, Prática ou Laboratório
    const turma = document.getElementById('turmaId').value.trim().toUpperCase() || "A";
    const prof = document.getElementById('profNome').value || "A definir";
    const semestre = document.getElementById('filtroSemestre').value;
    const ppc = document.getElementById('filtroPPC').value;

    // --- NOVA TRAVA DE SEGURANÇA ---
    const metaT = parseInt(document.getElementById('metaT').value) || 0;
    const metaP = parseInt(document.getElementById('metaP').value) || 0;

    const aulasDestaDisciplina = Object.values(grade).flat().filter(a => a.codigo === discSelecionada.codigo);
    const atualT = aulasDestaDisciplina.filter(a => a.tipo === 'Teórica').length;
    const atualP = aulasDestaDisciplina.filter(a => a.tipo !== 'Teórica').length;

    if (tipo === 'Teórica') {
        if (atualT >= metaT) return alert(`ERRO: A meta de aulas Teóricas é ${metaT}. Você não pode adicionar mais.`);
    } else {
        // Trata 'Prática' e 'Laboratório' como o mesmo grupo de meta 'P'
        if (atualP >= metaP) return alert(`ERRO: A meta de aulas Práticas/Laboratório é ${metaP}. Você não pode adicionar mais.`);
    }
    // -------------------------------

    const cellId = `${dia}-${horaId}`;
    if (!grade[cellId]) grade[cellId] = [];

    // Choques
    const todos = Object.values(grade).flat();
    if (prof !== "A definir" && todos.some(a => a.dia === dia && a.horaId === horaId && a.prof === prof))
        return alert(`CHOQUE: O professor ${prof} já está em aula neste horário.`);
    if (grade[cellId].some(a => a.semestre === semestre && a.ppc === ppc && a.codigo !== discSelecionada.codigo))
        return alert(`CONFLITO: O ${semestre}º Semestre já possui aula neste horário.`);
    if (grade[cellId].some(a => a.codigo === discSelecionada.codigo && a.turma === turma))
        return alert(`CHOQUE TURMA: A turma ${turma} desta disciplina já está alocada aqui.`);

    grade[cellId].push({
        codigo: discSelecionada.codigo, nome: discSelecionada.nome,
        turma, tipo, prof, sala: document.getElementById('salaAula').value || "S/I",
        semestre, ppc, dia, horaId
    });

    salvarEAtualizar();
}

function renderizarGrade() {
    const corpo = document.getElementById('corpoTabela');
    if(!corpo) return;
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
    salvarEAtualizar();
}

function salvarEAtualizar() {
    localStorage.setItem('grade_horarios_ufmt', JSON.stringify(grade));
    renderizarGrade();
    carregarDisciplinas();
    atualizarStatusCarga();
}

function limparGrade() { if(confirm("Deseja apagar tudo?")) { localStorage.clear(); location.reload(); } }
carregarDados();