import { createApp } from 'vue';
import SiteRoot from './SiteRoot.vue';

const SITE_ROOT_ID = 'archify-site-root';

const host = document.createElement('div');
host.id = SITE_ROOT_ID;
host.hidden = true;
document.body.append(host);
createApp(SiteRoot).mount(host);
