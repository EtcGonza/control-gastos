import { Component } from '@angular/core';
import { CategoriesManagerComponent } from './components/categories-manager/categories-manager.component';
import { DataBackupComponent } from './components/data-backup/data-backup.component';

@Component({
  selector: 'app-configuracion-page',
  standalone: true,
  imports: [CategoriesManagerComponent, DataBackupComponent],
  templateUrl: './configuracion-page.component.html',
})
export class ConfiguracionPageComponent {}
