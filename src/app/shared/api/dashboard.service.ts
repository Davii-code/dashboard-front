import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {ChartResponse} from '../models/chart-response';
import {environment} from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private baseUrl = environment.api;

  getChartData(tipoGrafico: string, dataInicio: string, dataFim: string) {
    const params = new HttpParams()
      .set('tipoGrafico', tipoGrafico)
      .set('dataInicio', dataInicio)
      .set('dataFim', dataFim);

    return this.http.get<ChartResponse>(`${this.baseUrl}/dashboard`, { params });
  }
}
