import {automaticProjects,automaticProjectRules,type AutomaticProject,type AutomaticApproval,type AutomaticProjectsView} from '../src/automatic-projects';

export class AutomaticProjects {
  private order:AutomaticProject[] = [];
  private approved:AutomaticApproval[] = [];
  private started = 0;
  reset(enabled:boolean,started:number,random:()=>number) {
    this.order = enabled ? Object.keys(automaticProjects) as AutomaticProject[] : [];
    for (let i=this.order.length-1;i>0;i--) {
      const j = Math.floor(random()*(i+1));
      [this.order[i],this.order[j]] = [this.order[j],this.order[i]];
    }
    this.approved = [];
    this.started = started;
  }
  get nextAt():number|undefined {
    return this.approved.length<this.order.length ? this.started+automaticProjectRules.firstAfter+this.approved.length*automaticProjectRules.interval : undefined;
  }
  approve(recipients:number):AutomaticApproval {
    const project = this.order[this.approved.length];
    const approval = {project,at:this.nextAt!,cost:automaticProjects[project].cost*recipients,recipients};
    this.approved.push(approval);
    return approval;
  }
  view(now:number,running:boolean):AutomaticProjectsView|undefined {
    if (!this.order.length) return;
    const last = this.approved.at(-1);
    return {approved:[...this.approved],total:this.order.length,
      nextIn:running && this.nextAt!==undefined ? Math.max(0,Math.ceil((this.nextAt-now)/1000)) : undefined,
      announcement:running && last && now-last.at<automaticProjectRules.announcementMs ? last : undefined};
  }
}
