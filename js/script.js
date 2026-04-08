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
    } catch (e) { alert("Erro ao carregar dados."); }
}

function carregarDisciplinas() {
    const ppc = document.getElementById('filtroPPC').value;
    const semestre = document.getElementById('filtroSemestre').value;
    const container = document.getElementById('listaDisciplinas');
    container.innerHTML = '';
    const filtradas = disciplinas.filter(d => d[`ppc_${ppc}`] == semestre);
    filtradas.forEach(d => {
        const div = document.createElement('div');
        div.className = `card-disc-item ${discSelecionada?.codigo === d.codigo ? 'active' : ''}`;
        div.innerHTML = `<div class="disc-info"><strong>${d.codigo}</strong><span>${d.nome}</span></div><span class="badge-ch">${d.carga_horaria}</span>`;
        div.onclick = () => selecionarDisciplina(d);
        container.appendChild(div);
    });
}

function selecionarDisciplina(d) {
    discSelecionada = d;
    document.getElementById('formConfig').style.display = 'block';
    document.getElementById('nomeDiscSelecionada').innerText = d.nome;
    atualizarStatusCarga();
    carregarDisciplinas();
}

function atualizarStatusCarga() {
    if (!discSelecionada) return;
    const turmaAtual = document.getElementById('turmaId').value.trim().toUpperCase();
    const chTotal = parseInt(discSelecionada.carga_horaria);

    // Filtra horas alocadas especificamente para ESTA disciplina nesta Turma
    let slotsTurma = 0;
    Object.values(grade).flat().forEach(aula => {
        if (aula.codigo === discSelecionada.codigo && aula.turma === turmaAtual) {
            slotsTurma++;
        }
    });

    const chRestante = chTotal - (slotsTurma * 32);
    document.getElementById('chTotal').innerText = chTotal;
    document.getElementById('chRestante').innerText = chRestante;
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
                        <div class="tipo-badge" onclick="alternarTipo('${cellId}', ${idx})">${aula.tipo[0]}</div>
                        <div class="turma-tag">${aula.turma}</div>
                        <strong class="disc-cod">${aula.codigo}</strong>
                        <div class="disc-nome">${aula.nome}</div>
                        <small class="prof-info">👤 ${aula.prof}</small>
                        <small class="sala-info">📍 ${aula.sala}</small>
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

function alocarNaGrade(dia, horaId) {
    if (!discSelecionada) return alert("Selecione uma disciplina à esquerda.");
    const turmaAtual = document.getElementById('turmaId').value.trim().toUpperCase() || "ÚNICA";
    atualizarStatusCarga();

    if (parseInt(document.getElementById('chRestante').innerText) <= 0) {
        return alert(`A Carga Horária da Turma ${turmaAtual} já foi totalmente alocada!`);
    }

    const cellId = `${dia}-${horaId}`;
    const profAtual = document.getElementById('profNome').value || "A definir";
    if (!grade[cellId]) grade[cellId] = [];

    // Choque de Professor
    const choqueProf = Object.values(grade).flat().find(a => a.dia === dia && a.horaId === horaId && a.prof === profAtual && profAtual !== "A definir");
    if (choqueProf) return alert(`CHOQUE DE PROFESSOR: ${profAtual} já está ocupado.`);

    grade[cellId].push({
        codigo: discSelecionada.codigo, nome: discSelecionada.nome,
        turma: turmaAtual, tipo: document.getElementById('tipoAula').value,
        prof: profAtual, sala: document.getElementById('salaAula').value || "S/I",
        semestre: document.getElementById('filtroSemestre').value,
        ppc: document.getElementById('filtroPPC').value,
        dia, horaId
    });

    localStorage.setItem('grade_horarios_ufmt', JSON.stringify(grade));
    renderizarGrade(); atualizarStatusCarga();
}

function alternarTipo(cellId, idx) {
    const tipos = ["Teórica", "Prática", "Laboratório"];
    let atual = tipos.indexOf(grade[cellId][idx].tipo);
    grade[cellId][idx].tipo = tipos[(atual + 1) % tipos.length];
    localStorage.setItem('grade_horarios_ufmt', JSON.stringify(grade));
    renderizarGrade();
}

function removerAula(cellId, idx) {
    grade[cellId].splice(idx, 1);
    if (grade[cellId].length === 0) delete grade[cellId];
    localStorage.setItem('grade_horarios_ufmt', JSON.stringify(grade));
    renderizarGrade(); atualizarStatusCarga();
}

function limparGrade() { if(confirm("Deseja resetar toda a grade?")) { localStorage.clear(); location.reload(); } }

carregarDados();