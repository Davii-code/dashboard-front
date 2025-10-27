import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Chart, ChartConfiguration } from 'chart.js/auto';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {DashboardService} from '../../shared/api/dashboard.service';
import {isMessage} from '../../shared/models/chart-response';
import {SummaryMetrics} from '../../shared/models/summary-metrics';
import {forkJoin} from 'rxjs';
import { MatSnackBar, MatSnackBarHorizontalPosition, MatSnackBarVerticalPosition } from '@angular/material/snack-bar';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  private fb = inject(FormBuilder);
  private api = inject(DashboardService);

  // snackbar service
  private snackBar = inject(MatSnackBar);
  private snackHPos: MatSnackBarHorizontalPosition = 'right';
  private snackVPos: MatSnackBarVerticalPosition = 'bottom';

  form = this.fb.group({
    tipoGrafico: ['line', Validators.required],
    dataInicio: [this.addDays(new Date(), -14), Validators.required],
    dataFim: [new Date(), Validators.required],
  });

  loading = signal(false);
  errorMsg = signal<string | null>(null);
  infoMsg = signal<string | null>(null);

  /**
   * Estatísticas exibidas nos cards
   */
  stats = {
    total: 0,
    media: 0,
    maximo: 0,
    minimo: 0,
    qtdVendas: 0,
    ticketMedio: 0,
    produtoTopNome: '-',
    produtoTopValor: 0,
    categoriaTopNome: '-',
    categoriaTopValor: 0,
  };

  /**
   * Instância atual do gráfico Chart.js
   */
  private chart?: Chart;

  /**
   * Guardamos o tipo atual do gráfico manualmente,
   * pra não depender de this.chart.config.type (que gera erro de tipagem).
   */
  private currentChartType: 'pie' | 'bar' | 'line' | null = null;

  /**
   * Paleta base
   */
  private colorCycle: string[] = [
    '#8B5CF6', '#22D3EE', '#10B981', '#F59E0B', '#EF4444', '#60A5FA',
    '#F472B6', '#A3E635', '#FB923C', '#38BDF8', '#E879F9', '#34D399',
  ];

  /**
   * Ação principal: buscar dados do período pro gráfico e KPIs
   */
  submit() {
    if (this.form.invalid) return;

    const tipo = this.form.value.tipoGrafico!;
    const start = this.toISO(this.form.value.dataInicio!);
    const end = this.toISO(this.form.value.dataFim!);

    this.loading.set(true);
    this.errorMsg.set(null);
    this.infoMsg.set(null);

    forkJoin({
      resumo: this.api.getResumo(start, end),
      chart: this.api.getChartData(tipo, start, end),
    }).subscribe({
      next: ({ resumo, chart }) => {
        this.loading.set(false);

        // KPIs
        this.applySummaryMetrics(resumo);

        // Gráfico
        if (isMessage(chart)) {
          // backend respondeu { message: 'Nenhum dado...' }
          const msg = chart.message || 'Sem dados para esse período.';
          this.infoMsg.set(msg);
          this.showInfoPopup(msg);

          this.destroyChart();
          this.currentChartType = null;
        } else {
          this.renderChart(chart.type, chart.labels, chart.data);
        }
      },
      error: (err) => {
        this.loading.set(false);

        const message =
          err?.error?.message ||
          'Erro ao buscar dados. Tente novamente mais tarde.';

        this.errorMsg.set(message);
        this.showErrorPopup(message);

        this.destroyChart();
        this.currentChartType = null;
        this.resetStats();
      },
    });
  }

  /**
   * Botão "Cores": reembaralha a paleta e reaplica o estilo visual
   * do gráfico atual sem chamar backend.
   */
  randomizeColors() {
    if (!this.chart || !this.currentChartType) return;

    // embaralhar a paleta
    this.colorCycle = this.shuffle([...this.colorCycle]);

    const labels = (this.chart.data.labels || []) as string[];
    const data = (this.chart.data.datasets[0].data || []) as number[];
    const ctx = this.chart.ctx as CanvasRenderingContext2D;

    const newColors = labels.map(
      (_, i) => this.colorCycle[i % this.colorCycle.length]
    );

    const newDataset = this.datasetFor(
      this.currentChartType,
      ctx,
      data,
      newColors
    );

    this.chart.data.datasets[0] = {
      ...this.chart.data.datasets[0],
      ...newDataset,
    };

    this.chart.update();

    // popup bonitinho pra feedback de ação
    this.showInfoPopup('Cores atualizadas 🎨');
  }

  // ---------------------- POPUP helpers ----------------------

  /**
   * Mostra popup de erro (vermelho)
   */
  private showErrorPopup(msg: string) {
    this.snackBar.open(msg, 'Fechar', {
      duration: 5000,
      panelClass: ['toast-error'],
      horizontalPosition: this.snackHPos,
      verticalPosition: this.snackVPos,
    });
  }

  /**
   * Mostra popup informativo (azul/verde)
   */
  private showInfoPopup(msg: string) {
    this.snackBar.open(msg, 'OK', {
      duration: 3000,
      panelClass: ['toast-info'],
      horizontalPosition: this.snackHPos,
      verticalPosition: this.snackVPos,
    });
  }

  // ---------------------- LÓGICA INTERNA ----------------------

  private applySummaryMetrics(resumo: SummaryMetrics) {
    this.stats = {
      total: resumo.total ?? 0,
      media: resumo.media ?? 0,
      maximo: resumo.maximo ?? 0,
      minimo: resumo.minimo ?? 0,
      qtdVendas: resumo.qtdVendas ?? 0,
      ticketMedio: resumo.ticketMedio ?? 0,
      produtoTopNome: resumo.produtoTop?.nome ?? '-',
      produtoTopValor: resumo.produtoTop?.valor ?? 0,
      categoriaTopNome: resumo.categoriaTop?.nome ?? '-',
      categoriaTopValor: resumo.categoriaTop?.valor ?? 0,
    };
  }

  private resetStats() {
    this.stats = {
      total: 0,
      media: 0,
      maximo: 0,
      minimo: 0,
      qtdVendas: 0,
      ticketMedio: 0,
      produtoTopNome: '-',
      produtoTopValor: 0,
      categoriaTopNome: '-',
      categoriaTopValor: 0,
    };
  }

  private renderChart(
    type: 'pie' | 'bar' | 'line',
    labels: string[],
    data: number[]
  ) {
    this.currentChartType = type;

    this.destroyChart();

    const canvas = document.getElementById(
      'chartCanvas'
    ) as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors = labels.map(
      (_, i) => this.colorCycle[i % this.colorCycle.length]
    );

    const cfg: ChartConfiguration = {
      type,
      data: {
        labels,
        datasets: [
          this.datasetFor(type, ctx, data, colors)
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: type !== 'line',
            labels: {
              color: '#E5E7EB',
              boxWidth: 18,
              boxHeight: 18,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(17,24,39,.95)',
            titleColor: '#E5E7EB',
            bodyColor: '#CBD5E1',
            borderColor: 'rgba(255,255,255,.08)',
            borderWidth: 1,
          },
        },
        scales:
          type === 'pie'
            ? {}
            : {
              x: {
                grid: { color: 'rgba(255,255,255,.06)' },
                ticks: { color: '#94A3B8' },
              },
              y: {
                border: { dash: [4, 4] },
                grid: { color: 'rgba(255,255,255,.06)' },
                ticks: { color: '#94A3B8' },
              },
            },
      },
    };

    this.chart = new Chart(ctx, cfg);
  }

  private datasetFor(
    type: 'pie' | 'bar' | 'line',
    ctx: CanvasRenderingContext2D,
    data: number[],
    colors: string[]
  ) {
    const canvas = ctx.canvas as HTMLCanvasElement;

    if (type === 'pie') {
      return {
        data,
        backgroundColor: colors.map((c) => this.withAlpha(c, 0.9)),
        borderWidth: 0,
      };
    }

    if (type === 'bar') {
      // gradiente barra a barra
      const grads = colors.map((c) => {
        const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
        g.addColorStop(0, this.withAlpha(c, 0.95));
        g.addColorStop(1, this.withAlpha(c, 0.25));
        return g;
      });

      return {
        data,
        backgroundColor: grads,
        borderColor: colors.map((c) => this.withAlpha(c, 1)),
        borderWidth: 1.5,
      };
    }

    // line
    const primary = colors[0] || '#8B5CF6';
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, this.withAlpha(primary, 0.35));
    g.addColorStop(1, this.withAlpha(primary, 0.02));

    return {
      data,
      fill: true,
      tension: 0.35,
      borderWidth: 2.5,
      borderColor: primary,
      pointRadius: 4,
      pointHoverRadius: 6,
      backgroundColor: g,
    };
  }

  private destroyChart() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = undefined;
    }
  }

  // ---------- utils helpers ----------

  private toISO(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private addDays(d: Date, diff: number) {
    const t = new Date(d);
    t.setDate(t.getDate() + diff);
    return t;
  }

  private withAlpha(hex: string, alpha = 1) {
    // recebe #RRGGBB e devolve rgba(r,g,b,a)
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  private shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
