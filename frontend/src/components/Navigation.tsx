import { NavLink } from "react-router-dom";
const links = [{to:"/",label:"Home",end:true},{to:"/join",label:"Join Queue"},{to:"/staff",label:"Staff"},{to:"/display",label:"Display"},{to:"/admin",label:"Admin"}];
export default function Navigation() {
  return <nav aria-label="Main navigation" className="flex flex-wrap gap-2">{links.map(({to,label,end})=><NavLink key={label} to={to} end={end} className={({isActive})=>isActive?"rounded-full bg-charcoal px-3 py-2 text-sm font-medium text-white":"rounded-full px-3 py-2 text-sm font-medium text-charcoal/75 hover:bg-blush/60"}>{label}</NavLink>)}</nav>;
}
