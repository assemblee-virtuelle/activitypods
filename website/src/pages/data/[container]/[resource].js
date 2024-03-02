import podProviders from "~/config/pod-providers";
import trustedApps from "~/config/trusted-apps";

const containers = {
    'pod-providers': podProviders,
    'trusted-apps': trustedApps
};

const ldpResource = (url, resource) => ({
    "@context": {
        apods: "http://activitypods.org/ns/core#",
        ldp: "http://www.w3.org/ns/ldp#",
    },
    "@id": url,
    ...resource
});


export async function get({ params, request }) {
    return {
        body: JSON.stringify(ldpResource(
            request.url,
            containers[params.container].find(r => r['apods:domainName'] === params.resource)
        ))
    }
}

export function getStaticPaths () {
    let paths = [];
    for (const key of Object.keys(containers)) {
			paths.push({ params: { container: key } })
        for (const resource of containers[key] ) {
            paths.push({ params: { container: key, resource: resource['apods:domainName'] } })
        }
    }
    return paths;
}
