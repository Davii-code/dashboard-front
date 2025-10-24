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

  // formulário
  form = this.fb.group({
    tipoGrafico: ['pie', Validators.required], // pie | bar | line
    dataInicio: [this.addDays(new Date(), -7), Validators.required],
    dataFim: [new Date(), Validators.required],
  });

  // estado
  loading = signal(false);
  errorMsg = signal<string | null>(null);
  infoMsg = signal<string | null>(null);

  // Chart.js
  private chart?: Chart;

  constructor() {
    // atualiza o gráfico ao enviar
  }

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
          return;
        }
        this.renderChart(res.type, res.labels, res.data);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err?.error?.message || 'Erro ao buscar dados.');
        this.destroyChart();
      },
    });
  }

  private renderChart(type: 'pie'|'bar'|'line', labels: string[], data: number[]) {
    this.destroyChart();
    const ctx = (document.getElementById('chartCanvas') as HTMLCanvasElement).getContext('2d');
    if (!ctx) return;

    const config: ChartConfiguration = {
      type,
      data: {
        labels,
        datasets: [{ data }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    };

    this.chart = new Chart(ctx, config);
  }

  private destroyChart() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = undefined;
    }
  }

  // utils
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
}
