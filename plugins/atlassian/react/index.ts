import {
  defineExecutorFrontendPlugin,
  liveFrontendPluginComponent,
} from "@executor/react/plugins";

import {
  AtlassianAddSourcePage,
  AtlassianDetailRoute,
  AtlassianEditRoute,
} from "./components";

export const AtlassianReactPlugin = defineExecutorFrontendPlugin({
  key: "atlassian",
  displayName: "Atlassian",
  routes: [
    {
      key: "add",
      path: "add",
      component: liveFrontendPluginComponent(() => AtlassianAddSourcePage),
    },
    {
      key: "detail",
      path: "sources/$sourceId",
      component: liveFrontendPluginComponent(() => AtlassianDetailRoute),
    },
    {
      key: "edit",
      path: "sources/$sourceId/edit",
      component: liveFrontendPluginComponent(() => AtlassianEditRoute),
    },
  ],
});
