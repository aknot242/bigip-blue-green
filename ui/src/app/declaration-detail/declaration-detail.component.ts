import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { BigIpService, AuthService } from '../bigip/services';
import { Declaration } from '../bigip/models/declaration';
import { ActivatedRoute, Router } from '@angular/router';
import { FormMode } from '../enums/form-mode'

const defaultRoute = '/';

@Component({
  selector: 'app-declaration-detail',
  templateUrl: './declaration-detail.component.html',
  styleUrls: ['./declaration-detail.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class DeclarationDetailComponent implements OnInit {

  constructor(public bigIpService: BigIpService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute) { }

  FormMode = FormMode;
  formMode = FormMode.Create;
  declaration = new Declaration();
  virtualServerList = new Array<string>();
  fullPoolList = new Array<string>();
  currentPoolList = new Array<string>();
  currentTrafficDist = 55;

  ngOnInit() {
    // TODO: Move authentication somewhere central to all modules. HttpInterceptor maybe?
    this.authService.authenticate()
      .subscribe(() => {
        this.bigIpService.getBigIpConfigData()
          .subscribe((config) => {
            this.virtualServerList = config.virtualServers
            .filter(v => v.hasHttpProfile)
            .map(v => v.fullPath) || [];
            this.fullPoolList = config.pools.map(p => p.fullPath) || [];
            this.currentPoolList = this.fullPoolList;
            const nameParam = this.route.snapshot.paramMap.get('name')
            if (nameParam) {
              this.getDeclaration(nameParam);
              this.formMode = FormMode.Edit;
            }
          })
      })
  }

  getDeclaration(declarationName: string): void {
    this.bigIpService.getDeclaration(declarationName)
      .subscribe(declaration => {
        this.declaration = declaration;
        this.currentTrafficDist = this.ratioToSliderValue(declaration.ratio);
      });
  }

  filterPools(selectedVirtualServer: string) {
    const partition = selectedVirtualServer.split('/')[1].toLowerCase();
    this.currentPoolList = this.fullPoolList.filter(p => p.toLowerCase().startsWith(`/${partition}`) || p.toLowerCase().startsWith('/common'));
  }

  goBack(): void {
    this.router.navigate([defaultRoute]);
  }

  save(): void {
    this.declaration.ratio = this.sliderValueToRatio(this.currentTrafficDist);
    this.bigIpService.saveDeclaration(this.declaration)
      .subscribe((result) => {
        if (result) {
          this.router.navigate([defaultRoute]);
        }
      });
  }

  shortenPath(path: string | null) {
    if (!path) { return '' };
    const array = path.split('/');
    return array[array.length - 1];
  }

  sliderValueToRatio(val: number) {
    return Number((100 - val) / 100);
  }

  ratioToSliderValue(val: number) {
    return Math.round(Number(100 - (val * 100)));
  }
}
