import { Component } from '@angular/core';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from '../services/auth.service';
import { CoreService } from '../services/core.service';

@Component({
  selector: 'app-header',
  imports: [NgbDropdownModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
 public defaultImg4U: string = "assets/images/user-photo.png";

  constructor(public auth:AuthService,private core:CoreService) {}

  onResize(event:any) {
    const sidebar: Element | null = document.querySelector(".sidebar");
    const collapsing_shadow: Element | null = document.querySelector(".collapsing_shadow");
    

    if (sidebar && collapsing_shadow) {
     
    //code block which toggle last connection display and sidebarcollapse button on window size change
    if(window.innerWidth < 991){

      this.core.iconCollapse=true
    }else{

      this.core.iconCollapse=false;
    }
    
    //code block which removes all additional classes on sidenav and header nav for default display to work
      sidebar.classList.remove("closeSideBarLargeScreen");
      sidebar.classList.remove("openSideBar");
      collapsing_shadow.classList.remove("openSideBar");
  }
   
  }
}
