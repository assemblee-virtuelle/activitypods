import podProviders from "~/config/pod-providers";
import trustedApps from "~/config/trusted-apps";

const data = {
    'pod-providers': podProviders,
    'trusted-apps': trustedApps
};

const ldpContainer = (url, resources, slug) => ({
    "@context": {
        apods: "http://activitypods.org/ns/core#",
        ldp: "http://www.w3.org/ns/ldp#",
    },
    "@id": url,
    "@type": ["ldp:Container","ldp:BasicContainer"],
    "ldp:contains": [resources.map(resource => ({
        '@id': url + '/' + resource[slug],
        ...resource,
    }))]
});

export async function get({ params, request }) {
    return {
        body: JSON.stringify(ldpContainer(
            request.url,
            data[params.container],
            "apods:domainName"
        ))
    }
}

export function getStaticPaths () {
    return [ 
        { params: { container: "pod-providers" } },
        { params: { container: "trusted-apps" } }
    ]
}
