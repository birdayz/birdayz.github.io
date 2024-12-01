---
title: "Managing multiple DNS zones with Terraform and Google Cloud DNS"
date: 2020-07-10T00:00:00+02:00
draft: false
tags: [google cloud,gcp,terraform,cloud dns,dns]
---

Google Cloud DNS is a convenient way to manage DNS Zones. With Terraform, it's possible to manage these Zones as code, usually by committing the terraform files to version control.
However, setting up sub-zones has always been a bit tricky. I'll use this blog post to document how to manage zones and sub-zones with CloudDNS and terraform.

To manage a zone, the resource `google_dns_managed_zone` can be used:
<script src="https://gist.github.com/birdayz/85d5bd21746b1448d9776c5d9c8f48e3.js"></script>

To add a sub-zone:
<script src="https://gist.github.com/birdayz/2ce13ac71e0d20609b0f405f94346d1f.js"></script>

Now we have two zones, but the sub-zone is not reachable. Due to how the DNS works, we have to add NS records to the "top" zone, that point to the sub-zone:
<script src="https://gist.github.com/birdayz/723d4b9c42336e8d3fde9a536e984507.js"></script>

This record resides in the "top-level" zone my-domain.com, and points to the sub-zone `subdomain.my-domain.com`. By using the attribute `name_servers` of the `google_dns_managed_zone` resource, we can connect these two zones within terraform. GCP defines the DNS servers for each zone, by using the `name_servers` attribute we can dynamically refer to the used dns servers.

Please note: the above examples require Terraform 0.12+.
