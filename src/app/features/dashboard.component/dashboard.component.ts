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
  private destroyRef = inject(DestroyRef);

  form = this.fb.group({
    tipoGrafico: ['line', Validators.required],
    dataInicio: [this.addDays(new Date(), -14), Validators.required],
    dataFim: [new Date(), Validators.required],
  });

  loading = signal(false);
  errorMsg = signal<string | null>(null);
  infoMsg = signal<string | null>(null);

  // estatísticas exibidas nos KPIs
  stats = { total: 0, avg: 0, max: 0, min: 0 };

  private chart?: Chart;

  // paleta vibrante para slices/barras
  private colorCycle = [
    '#8B5CF6', '#22D3EE', '#10B981', '#F59E0B', '#EF4444', '#60A5FA',
    '#F472B6', '#A3E635', '#FB923C', '#38BDF8', '#E879F9', '#34D399',
  ];

  submit() {
    if (this.form.invalid) return;

    const tipo = this.form.value.tipoGrafico!;
    const start = this.toISO(this.form.value.dataInicio!);
    const end = this.toISO(this.form.value.dataFim!);

    this.loading.set(true);
    this.errorMsg.set(null);
    this.infoMsg.set(null);

    this.api.getChartData(tipo, start, end).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (isMessage(res)) {
          this.infoMsg.set(res.message);
          this.destroyChart();
          this.stats = { total: 0, avg: 0, max: 0, min: 0 };
          return;
        }
        // KPIs: calcula com os dados recebidos
        const arr = res.data ?? [];
        const total = arr.reduce((a, b) => a + b, 0);
        const max = arr.length ? Math.max(...arr) : 0;
        const min = arr.length ? Math.min(...arr) : 0;
        const avg = arr.length ? total / arr.length : 0;
        this.stats = { total, avg, max, min };

        this.renderChart(res.type, res.labels, res.data);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err?.error?.message || 'Erro ao buscar dados.');
        this.destroyChart();
        this.stats = { total: 0, avg: 0, max: 0, min: 0 };
      },
    });
  }

  randomizeColors(){
    // embaralha a paleta para dar sensação “colorful”
    this.colorCycle = this.shuffle([...this.colorCycle]);
    // re-renderiza com as novas cores sem chamar API
    if(this.chart){ this.chart.update(); }
  }

  private renderChart(type: 'pie'|'bar'|'line', labels: string[], data: number[]) {
    this.destroyChart();
    const canvas = document.getElementById('chartCanvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors = labels.map((_, i) => this.colorCycle[i % this.colorCycle.length]);

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
            labels: { color: '#E5E7EB', boxWidth: 18, boxHeight: 18 }
          },
          tooltip: {
            backgroundColor: 'rgba(17,24,39,.95)',
            titleColor: '#E5E7EB',
            bodyColor: '#CBD5E1',
            borderColor: 'rgba(255,255,255,.08)',
            borderWidth: 1,
          }
        },
        scales: (type === 'pie') ? {} : {
          x: {
            grid: { color: 'rgba(255,255,255,.06)' },
            ticks: { color: '#94A3B8' },
          },
          y: {
            border: { dash: [4,4] },
            grid: { color: 'rgba(255,255,255,.06)' },
            ticks: { color: '#94A3B8' },
          }
        },
      },
    };

    this.chart = new Chart(ctx, cfg);
  }

  private datasetFor(type: 'pie'|'bar'|'line', ctx: CanvasRenderingContext2D, data: number[], colors: string[]){
    const canvas = ctx.canvas as HTMLCanvasElement;

    if (type === 'pie') {
      return {
        data,
        backgroundColor: colors.map(c => this.withAlpha(c, 0.9)),
        borderWidth: 0,
      };
    }

    if (type === 'bar') {
      // gradiente vertical por barra
      const grads = colors.map(c => {
        const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
        g.addColorStop(0, this.withAlpha(c, 0.95));
        g.addColorStop(1, this.withAlpha(c, 0.25));
        return g;
      });
      return {
        data,
        backgroundColor: grads,
        borderColor: colors.map(c => this.withAlpha(c, 1)),
        borderWidth: 1.5,
      };
    }

    // line: uma cor principal com preenchimento suave
    const primary = colors[0] || '#8B5CF6';
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, this.withAlpha(primary, 0.35));
    g.addColorStop(1, this.withAlpha(primary, 0.02));
    return {
      data,
      fill: true,
      tension: .35,
      borderWidth: 2.5,
      borderColor: primary,
      pointRadius: 4,
      pointHoverRadius: 6,
      backgroundColor: g,
    };
  }

  private destroyChart(){
    if(this.chart){ this.chart.destroy(); this.chart = undefined; }
  }

  // utils
  private toISO(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  private addDays(d: Date, diff: number) { const t = new Date(d); t.setDate(t.getDate() + diff); return t; }
  private withAlpha(hex: string, alpha = 1){
    // aceita #RRGGBB; converte para rgba(r,g,b,alpha)
    const c = hex.replace('#','');
    const r = parseInt(c.substring(0,2),16);
    const g = parseInt(c.substring(2,4),16);
    const b = parseInt(c.substring(4,6),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  private shuffle<T>(arr:T[]):T[]{ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]] } return arr; }
}
