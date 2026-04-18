const { createApp } = Vue;

createApp({
    data() {
        return {
            DB_KEY: 'UFMT_SISTEMA_V12',
            disciplinas: [],
            optativas: [],
            grade: [],
            periodoSelecionado: '2026/1',
            filtroPPC: '20261',
            filtroSemestre: 1,
            showModal: false,
            editandoAulaUid: null,
            cellSendoAlocada: null,
            formAula: { snapshotEtiquetas: '', prof: '', sala: '', tipo: 'Teórica' },
            discSendoAlocada: null,
            internalDragData: null,
            optativaSelecionadaCod: '',
            dias: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"],
            horarios: [
                { id: "M1", label: "07:30 - 09:30" }, { id: "M2", label: "09:30 - 11:30" },
                { id: "T1", label: "13:30 - 15:30" }, { id: "T2", label: "15:30 - 17:30" }
            ],
            REGRAS_OFERTA: {
                "2026/1": { "20261": [1], "20251": [2, 4, 6, 8] },
                "2026/2": { "20261": [2], "20251": [3, 5, 7] },
                "2027/1": { "20261": [1, 3], "20251": [4, 6, 8] },
                "2027/2": { "20261": [2, 4], "20251": [5, 7] },
                "2028/1": { "20261": [1, 3, 5], "20251": [6, 8] },
                "2028/2": { "20261": [2, 4, 6], "20251": [7] },
                "2029/1": { "20261": [1, 3, 5, 7], "20251": [8] },
                "2029/2": { "20261": [2, 4, 6, 8], "20251": [] },
                "2030/1": { "20261": [1, 3, 5, 7], "20251": [] },
            }
        }
    },
    computed: {
        periodos() { return Object.keys(this.REGRAS_OFERTA); },
        optativasOrdenadas() { return [...this.optativas].sort((a,b) => a.nome.localeCompare(b.nome)); },
        disciplinasFiltradas() {
            return this.disciplinas.filter(d => {
                const semD = d[`ppc_${this.filtroPPC}`] || d[`PPC_${this.filtroPPC}`];
                return Number(semD) === Number(this.filtroSemestre);
            });
        },
        conflitosDetectados() {
            let conflitos = [];
            if (!this.grade || this.grade.length === 0) return [];

            this.dias.forEach(dia => {
                this.horarios.forEach(h => {
                    const aulas = this.getAulasNoSlot(dia, h.id);
                    if (aulas.length > 1) {
                        for (let i = 0; i < aulas.length; i++) {
                            for (let j = i + 1; j < aulas.length; j++) {
                                const a1 = aulas[i]; const a2 = aulas[j];

                                // 1. Conflito de Mesma Disciplina no mesmo horário
                                if (a1.codigo === a2.codigo) {
                                    conflitos.push({ msg: `Mesma Disciplina (${a1.nome}) repetida no horário (${dia} ${h.label}).` });
                                }
                                // 2. Conflito de Mesmo PPC e Semestre
                                else if (a1.ppc === a2.ppc && Number(a1.semestre) === Number(a2.semestre)) {
                                    conflitos.push({ msg: `Mesmo Semestre (${a1.semestre}º) do PPC ${a1.ppc} em choque (${dia} ${h.label}).` });
                                }
                            }
                        }
                    }
                });
            });
            return conflitos;
        }
    },
    async mounted() {
        try {
            const resOb = await fetch('./data/disciplinas_obrigatorias.json');
            this.disciplinas = await resOb.json();
            const resOpt = await fetch('./data/disciplinas_optativas.json');
            this.optativas = await resOpt.json();
            const saved = localStorage.getItem(this.DB_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.grade = Array.isArray(parsed) ? parsed : this.converterGrade(parsed);
            }
        } catch (e) { this.grade = []; }
    },
    methods: {
        getAulasNoSlot(dia, hId) {
            return this.grade.filter(a => a.dia === dia && a.horaId === hId && a.periodo === this.periodoSelecionado);
        },
        getColor(s) { return { 1: "#e3f2fd", 2: "#f1f8e9", 3: "#fff3e0", 4: "#f3e5f5", 5: "#efebe9", 6: "#e0f2f1", 7: "#fffde7", 8: "#ffebee" }[s] || "#f1f5f9"; },
        limparTexto(val) { return val ? val.toString().replace(/[\[\]"']/g, '') : ''; },
        getSemestresOfertados(ppc) { return this.REGRAS_OFERTA[this.periodoSelecionado]?.[ppc] || []; },
        getDisciplinasPorPPCeSem(ppc, s) { return this.disciplinas.filter(d => (d[`ppc_${ppc}`] || d[`PPC_${ppc}`]) == s); },
        estaAlocada(cod) { return this.grade.some(a => a.codigo === cod && a.periodo === this.periodoSelecionado); },

        // --- INTERAÇÕES ---
        toggleSelection(d) { this.discSendoAlocada = (this.discSendoAlocada?.codigo === d.codigo) ? null : d; },
        selecionarParaTablet(d) { this.discSendoAlocada = d; },
        selecionarOptativa() {
            if (!this.optativaSelecionadaCod) return;
            this.discSendoAlocada = this.optativas.find(o => o.codigo === this.optativaSelecionadaCod);
        },
        cellClicked(dia, hId) { if (this.discSendoAlocada) { this.cellSendoAlocada = `${dia}-${hId}`; this.abrirModal(); } },
        onDragStartExternal(e, d) { this.discSendoAlocada = d; this.internalDragData = null; },
        onDragStartInternal(e, a) { this.internalDragData = { aula: a }; this.discSendoAlocada = null; },
        onDrop(e, dia, hId) {
            if (this.internalDragData) {
                const target = this.grade.find(x => x.uid === this.internalDragData.aula.uid);
                if (target) { target.dia = dia; target.horaId = hId; this.persistir(); }
                this.internalDragData = null;
            } else if (this.discSendoAlocada) {
                this.cellSendoAlocada = `${dia}-${hId}`;
                this.abrirModal();
            }
        },

        // --- ALOCAÇÃO ---
        abrirModal() {
            if (!this.editandoAulaUid) {
                this.formAula = { snapshotEtiquetas: 'A', prof: 'A definir', sala: 'S/N', tipo: 'Teórica' };
            }
            this.showModal = true;
        },
        fecharModal() { this.showModal = false; this.editandoAulaUid = null; this.discSendoAlocada = null; },
        confirmarAlocacao() {
            if (!this.formAula.snapshotEtiquetas) return alert("Informe a turma!");
            const [dia, horaId] = this.cellSendoAlocada.split('-');
            const ppcAtivo = this.filtroPPC;
            const semD = this.discSendoAlocada[`ppc_${ppcAtivo}`] || this.discSendoAlocada[`PPC_${ppcAtivo}`];

            if (this.editandoAulaUid) this.grade = this.grade.filter(a => a.uid !== this.editandoAulaUid);

            this.grade.push({
                uid: this.editandoAulaUid || 'ID' + Date.now(),
                codigo: this.discSendoAlocada.codigo, nome: this.discSendoAlocada.nome,
                semestre: semD, periodo: this.periodoSelecionado, ppc: ppcAtivo,
                dia, horaId, prof: this.formAula.prof, sala: this.formAula.sala,
                tipo: this.formAula.tipo, snapshotEtiquetas: this.formAula.snapshotEtiquetas
            });
            this.persistir(); this.fecharModal();
        },
        abrirEdicao(a) {
            this.discSendoAlocada = { codigo: a.codigo, nome: a.nome, [`ppc_${a.ppc}`]: a.semestre };
            this.cellSendoAlocada = `${a.dia}-${a.horaId}`;
            this.editandoAulaUid = a.uid;
            this.formAula = { snapshotEtiquetas: a.snapshotEtiquetas, prof: a.prof, sala: a.sala, tipo: a.tipo };
            this.showModal = true;
        },
        removerAula(uid) {
            if (confirm("Remover aula?")) {
                this.grade = this.grade.filter(a => a.uid !== uid);
                this.persistir();
            }
        },

        // --- UTILITÁRIOS ---
        persistir() { localStorage.setItem(this.DB_KEY, JSON.stringify(this.grade)); },
        converterGrade(dado) {
            let novoArray = [];
            Object.keys(dado).forEach(key => {
                const [dia, horaId] = key.split('-');
                if(Array.isArray(dado[key])) dado[key].forEach(aula => { novoArray.push({ ...aula, dia, horaId }); });
            });
            return novoArray;
        },
        triggerInputGrade() { this.$refs.fileGrade.click(); },
        lerArquivoGrade(e) {
            const r = new FileReader();
            r.onload = (ev) => {
                const data = JSON.parse(ev.target.result);
                this.grade = Array.isArray(data) ? data : this.converterGrade(data);
                this.persistir();
            };
            r.readAsText(e.target.files[0]);
        },
        exportarJSON() {
            const b = new Blob([JSON.stringify(this.grade, null, 2)], { type: 'application/json' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `grade.json`; a.click();
        },
        exportarExcel() {
            const data = [["Dia", "Horário", "Código", "Disciplina", "Turma", "Professor", "Sala"]];
            this.grade.filter(a => a.periodo === this.periodoSelecionado).forEach(a => {
                data.push([a.dia, a.horaId, a.codigo, a.nome, this.limparTexto(a.snapshotEtiquetas), a.prof, a.sala]);
            });
            XLSX.writeFile({ SheetNames: ["Grade"], Sheets: { "Grade": XLSX.utils.aoa_to_sheet(data) } }, `Grade_${this.periodoSelecionado.replace('/','_')}.xlsx`);
        },
        exportarEncargosExcel() {
            const d = this.processarDocentes();
            const rows = [["Professor", "H/S Total", "Encargo Total (x2.5)", "Disciplina", "Turma"]];
            d.forEach(doc => {
                doc.atividades.forEach((atv, i) => {
                    rows.push([i === 0 ? doc.nome : "", i === 0 ? doc.hSemanais : "", i === 0 ? doc.hTotalEncargo : "", atv.nome, atv.turmas]);
                });
            });
            XLSX.writeFile({ SheetNames: ["Encargos"], Sheets: { "Encargos": XLSX.utils.aoa_to_sheet(rows) } }, `Encargos_${this.periodoSelecionado.replace('/','_')}.xlsx`);
        },
        imprimirRelatorioCompleto() {
            const periodo = this.periodoSelecionado;
            const rel = {};

            // 1. Filtrar aulas do período ativo
            const aulasAtivas = this.grade.filter(a => a.periodo === periodo);

            // 2. Agrupar por PPC -> Semestre -> Chave de Atividade
            aulasAtivas.forEach(a => {
                if (!rel[a.ppc]) rel[a.ppc] = {};
                if (!rel[a.ppc][a.semestre]) rel[a.ppc][a.semestre] = {};

                const hLabel = this.horarios.find(h => h.id === a.horaId)?.label || "";
                const turmaLimpa = this.limparTexto(a.snapshotEtiquetas);

                // Chave: Código + Tipo + Turma + Professor (Para agrupar horários da mesma oferta)
                const chaveAgrupamento = `${a.codigo}-${a.tipo}-${turmaLimpa}-${a.prof}`;

                if (!rel[a.ppc][a.semestre][chaveAgrupamento]) {
                    rel[a.ppc][a.semestre][chaveAgrupamento] = {
                        codigo: a.codigo,
                        nome: a.nome,
                        tipo: a.tipo,
                        turma: turmaLimpa,
                        professor: a.prof || "A definir",
                        horarios: []
                    };
                }

                rel[a.ppc][a.semestre][chaveAgrupamento].horarios.push({
                    dia: a.dia,
                    label: hLabel,
                    sala: a.sala || "S/N"
                });
            });

            const win = window.open('', '', 'width=1150,height=850');
            let h = `<html><head><style>
        body { font-family: sans-serif; padding: 30px; color: #333; line-height: 1.4; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
        th, td { border: 1px solid #ccc; padding: 10px; font-size: 11px; text-align: left; vertical-align: top; }
        th { background: #003d79; color: white; text-transform: uppercase; }
        h1 { color: #003d79; border-bottom: 2px solid #003d79; }
        h2 { background: #f4f4f4; padding: 10px; border-left: 8px solid #003d79; margin-top: 40px; font-size: 18px; }
        h3 { color: #003d79; font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        .tag-turma { color: #d32f2f; font-weight: bold; }
        .tipo-t { color: #003d79; font-weight: bold; } /* Estilo Teórica */
        .tipo-p { color: #059669; font-weight: bold; } /* Estilo Prática */
        .horario-item { margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid #eee; }
        .horario-item:last-child { border-bottom: none; }
    </style></head><body>`;

            h += `<h1>Relatório de Oferta Acadêmica - Período ${periodo}</h1>`;

            Object.keys(rel).sort().forEach(ppc => {
                h += `<h2>PPC: ${ppc}</h2>`;

                Object.keys(rel[ppc]).sort((a, b) => a - b).forEach(sem => {
                    h += `<h3>${sem}º Semestre Curricular</h3>
            <table>
                <thead>
                    <tr>
                        <th width="25%">Disciplina</th>
                        <th width="10%">Tipo</th>
                        <th width="15%">Turma(s)</th>
                        <th width="20%">Professor</th>
                        <th width="30%">Horários e Salas</th>
                    </tr>
                </thead>
                <tbody>`;

                    // 3. ORDENAÇÃO ESPECIAL: Nome -> Teórica antes de Prática -> Turma
                    const listaOrdenada = Object.values(rel[ppc][sem]).sort((a, b) => {
                        // Primeiro por Nome da Disciplina
                        if (a.nome !== b.nome) return a.nome.localeCompare(b.nome);

                        // Segundo por Tipo (Teórica vem antes de Prática)
                        // Usamos o peso: Teórica = 1, Prática = 2
                        const pesoA = a.tipo === "Teórica" ? 1 : 2;
                        const pesoB = b.tipo === "Teórica" ? 1 : 2;
                        if (pesoA !== pesoB) return pesoA - pesoB;

                        // Terceiro por Turma
                        return a.turma.localeCompare(b.turma);
                    });

                    listaOrdenada.forEach(item => {
                        const diasOrdem = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
                        item.horarios.sort((a, b) => diasOrdem.indexOf(a.dia) - diasOrdem.indexOf(b.dia));

                        const htmlHorarios = item.horarios.map(hor => `
                    <div class="horario-item">
                        <b>${hor.dia}</b>: ${hor.label} | <small>Sala: ${hor.sala}</small>
                    </div>
                `).join('');

                        const classeTipo = item.tipo === "Teórica" ? "tipo-t" : "tipo-p";

                        h += `<tr>
                    <td><strong>${item.nome}</strong><br><small>${item.codigo}</small></td>
                    <td class="${classeTipo}">${item.tipo}</td>
                    <td class="tag-turma">${item.turma}</td>
                    <td><b>${item.professor}</b></td>
                    <td>${htmlHorarios}</td>
                </tr>`;
                    });
                    h += `</tbody></table>`;
                });
            });

            h += `<script>window.onload = function() { window.print(); };<\/script></body></html>`;
            win.document.write(h);
            win.document.close();
        },
        gerarGradeHTML() {
            const periodo = this.periodoSelecionado;
            const win = window.open('', '', 'width=1200,height=900');

            // 1. Identificar quais semestres possuem aulas (únicos e ordenados)
            const semestresAtivos = [...new Set(this.grade
                .filter(a => a.periodo === periodo)
                .map(a => Number(a.semestre))
            )].sort((a, b) => a - b);

            if (semestresAtivos.length === 0) {
                return alert("Não há aulas cadastradas para este período.");
            }

            let html = `<html><head><title>Grades por Semestre - ${periodo}</title><style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        
        @page { 
            size: A4 landscape; 
            margin: 1cm; 
        }

        body { font-family: 'Inter', sans-serif; padding: 0; margin: 0; background: #fff; color: #333; }
        
        /* Container de cada semestre para quebra de página */
        .page-container {
            page-break-after: always;
            padding-bottom: 20px;
        }
        
        .page-container:last-child {
            page-break-after: auto;
        }

        h1 { text-align: center; color: #003d79; margin: 10px 0; font-size: 22px; font-weight: 800; text-transform: uppercase; }
        h2 { text-align: center; color: #475569; margin-bottom: 20px; font-size: 18px; font-weight: 600; }
        
        table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 2px solid #333; }
        th { background: #003d79 !important; color: white !important; padding: 12px; font-size: 13px; border: 1px solid #333; text-transform: uppercase; }
        td { border: 1px solid #333; vertical-align: top; padding: 8px; height: 180px; background-color: #fff; }
        
        .time-label { background: #f1f5f9 !important; text-align: center; font-weight: bold; font-size: 11px; width: 100px; vertical-align: middle; color: #003d79; border: 1px solid #333; }
        
        .card-export { 
            border: 1px solid rgba(0,0,0,0.1); 
            padding: 12px; 
            margin-bottom: 10px; 
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
        }
        
        .card-export .subject-name { 
            font-weight: 800; 
            color: #003d79; 
            font-size: 12px; 
            display: block; 
            margin-bottom: 5px; 
            line-height: 1.3;
        }
        
        .card-export .details { 
            font-size: 11px; 
            color: #334155; 
            line-height: 1.5;
            border-top: 1px solid rgba(0,0,0,0.1);
            padding-top: 5px;
            margin-top: 5px;
        }
        
        .turma-label { 
            display: inline-block; 
            border: 1.5px solid #003d79;
            color: #003d79; 
            padding: 2px 8px; 
            border-radius: 4px; 
            font-size: 10px; 
            margin-top: 10px;
            font-weight: 800;
            background: rgba(255,255,255,0.8);
        }

        .ppc-tag {
            font-size: 9px;
            font-weight: 700;
            color: #64748b;
            margin-bottom: 4px;
            display: block;
        }

        .no-print { 
            text-align: right; 
            padding: 15px; 
            background: #f8fafc; 
            border-bottom: 1px solid #e2e8f0;
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .btn-print { padding: 12px 25px; cursor: pointer; background: #003d79; color: white; border: none; border-radius: 6px; font-weight: bold; }

        @media print {
            .no-print { display: none !important; }
            body { padding: 0; }
            .page-container { padding-bottom: 0; }
        }
    </style></head><body>`;

            html += `<div class="no-print"><button class="btn-print" onclick="window.print()">🖨️ Imprimir Todas as Folhas (A4 Paisagem)</button></div>`;

            // 2. Gerar uma folha/tabela para cada semestre
            semestresAtivos.forEach(sem => {
                html += `<div class="page-container">`;
                html += `<h1>Grade Horária - Período ${periodo}</h1>`;
                html += `<h2>Curso de Engenharia de Computação - ${sem}º Semestre Curricular</h2>`;

                html += `<table><thead><tr><th>Horário</th>`;
                this.dias.forEach(dia => { html += `<th>${dia}</th>`; });
                html += `</tr></thead><tbody>`;

                this.horarios.forEach(h => {
                    html += `<tr><td class="time-label">${h.label}</td>`;

                    this.dias.forEach(dia => {
                        html += `<td>`;
                        // Filtrar aulas: Mesmo período, mesmo dia, mesmo horário E MESMO SEMESTRE
                        const aulas = this.grade.filter(a =>
                            a.periodo === periodo &&
                            a.dia === dia &&
                            a.horaId === h.id &&
                            Number(a.semestre) === sem
                        );

                        aulas.forEach(aula => {
                            const corSemestre = this.getColor(aula.semestre);
                            const turmaLimpa = this.limparTexto(aula.snapshotEtiquetas);
                            const ppcFormatado = aula.ppc ? `PPC ${aula.ppc.substring(0,4)}/${aula.ppc.substring(4)}` : "";

                            html += `
                        <div class="card-export" style="background-color: ${corSemestre} !important;">
                            <span class="ppc-tag">${ppcFormatado}</span>
                            <span class="subject-name">${aula.nome}</span>
                            <div class="details">
                                <strong>Código:</strong> ${aula.codigo}<br>
                                <strong>Professor:</strong> ${aula.prof || 'A definir'}<br>
                                <strong>Sala:</strong> ${aula.sala || 'S/N'} (${aula.tipo})
                            </div>
                            <span class="turma-label">${turmaLimpa}</span>
                        </div>
                    `;
                        });
                        html += `</td>`;
                    });
                    html += `</tr>`;
                });

                html += `</tbody></table></div>`;
            });

            html += `</body></html>`;

            win.document.write(html);
            win.document.close();
        },
        imprimirRelatorioEncargos() {
            const dados = this.processarDocentes();
            const win = window.open('', '', 'width=1100,height=850');
            let h = `<html><head><style>body{font-family:sans-serif;padding:30px;color:#333}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #ccc;padding:10px;font-size:12px;text-align:left}th{background:#003d79;color:white}</style></head><body><h1>Relatório de Encargos Docentes - ${this.periodoSelecionado}</h1><table border="1"><thead><tr><th>Professor</th><th>H/S</th><th>Encargo (x2.5)</th><th>Disciplinas</th></tr></thead><tbody>`;
            dados.forEach(d => {
                h += `<tr><td><strong>${d.nome}</strong></td><td>${d.hSemanais}h</td><td>${d.hTotalEncargo}h</td><td>${d.atividades.map(at => at.nome + ' (' + at.turmas + ')').join('<br>')}</td></tr>`;
            });
            h += `</table><script>window.print();<\/script></body></html>`;
            win.document.write(h); win.document.close();
        },
        processarDocentes() {
            const d = {};
            this.grade.filter(a => a.periodo === this.periodoSelecionado).forEach(aula => {
                const p = aula.prof || "A definir";
                if (!d[p]) d[p] = { totalSlots: 0, atividades: {} };
                d[p].totalSlots += 1;
                const chave = `${aula.codigo}-${aula.tipo}-${aula.snapshotEtiquetas}`;
                if (!d[p].atividades[chave]) d[p].atividades[chave] = { nome: aula.nome, turmas: this.limparTexto(aula.snapshotEtiquetas) };
            });
            return Object.keys(d).sort().map(nome => ({
                nome, hSemanais: d[nome].totalSlots * 2, hTotalEncargo: (d[nome].totalSlots * 5),
                atividades: Object.values(d[nome].atividades)
            }));
        },
        resetar() { if(confirm("Limpar tudo?")) { this.grade = []; this.persistir(); location.reload(); } }
    }
}).mount('#app');