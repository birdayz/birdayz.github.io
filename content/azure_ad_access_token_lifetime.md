---
title: "Increasing Azure AD Access Token Lifetimes"
date: 2020-09-03T00:00:00+02:00
draft: false
tags: [azure,azuread,accesstoken,lifetime,spa,token]
---

By default, Azure AD Access Tokens have a lifetime of 1hour. Especially for single page apps, it's very inconvenient. Users have to re-login every hour. Ideally, it's just one redirect to the login of Azure AD, and there they still are within their session, and AD redirects them back to your app. However this can still be very painful, e.g. if the user does something within your app, and gets pretty much logged out because all API calls fail due to an expired token. My experience is, that 1 hour is too short. It has security benefits of course, but the complexity in the app increases significantly if you start dealing with expired tokens, saving state to local storage, and transmitting data after a successful re-login for example.

It is indeed possible to change the token lifetime, for just a specific application. It's just not very well documented, and only possible via Powershell. Also, it can be only done by an Azure AD Admin. In combination with Powershell only (i don't have Powershell/Windows) and the lack of documentation, it took me forever to figure this out. Luckily, you'll now get the solution.


Create policy
```powershell
$policy = New-AzureADPolicy -Definition @('{"TokenLifetimePolicy":{"Version":1,"AccessTokenLifetime":"10:00:00"}}') -DisplayName "my_policy_name" -IsOrganizationDefault $false -Type "TokenLifetimePolicy"
```

Get reference to your AD App Registration
```powershell
$app = Get-AzureADApplication -Filter "DisplayName eq 'my-app-reg-name'"
```

Double check the ID of the app reg to be sure it's the correct app.


Assign policy to your AD App Registration
```powershell
Add-AzureADApplicationPolicy -Id $app.ObjectId -RefObjectId $policy.Id
```
