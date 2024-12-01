---
title: "Using kaf for Azure EventHub"
date: 2020-04-12T00:00:00+02:00
draft: false
tags: [kafka,kaf,azure eventhub,eventhub,eventhub cli]
---


Since [kaf v0.1.35](https://github.com/birdayz/kaf/releases/tag/v0.1.35) it is now possible to interact with `Azure EventHub`. Kaf is a modern CLI to interact with Kafka, i.e. producing data, consuming, or viewing topic and Consumer Group information. Now having first-class support for EventHub makes EventHub much more accessible than before. In the following Example i'll show how to set up kaf for your EventHub. It's very simple.

# Install kaf
There's several ways to install kaf.
## Install script
```shell
curl https://raw.githubusercontent.com/birdayz/kaf/master/godownloader.sh | BINDIR=$HOME/bin bash
```
## Via AUR
```
yay -S kaf
```
## Via Go
```
go get github.com/birdayz/kaf/cmd/kaf
```

# Setup EventHub

To create an EventHub, you have to first create an EventHubs namespace.
The equivalent to a `EventHub Namespace` in the Kafka world is a `Kafka Cluster`.

This can be either done on the Portal, or via CLI:

```shell
az eventhubs namespace create --name joe-test-2 --resource-group my-resource-group
```
This command may take some minutes to complete.

Since quite some time, the `Kafka compatibility mode` is enabled by default for all new EventHub Namespaces, so you don't need to explicitly enable it.

After creating the EventHub Namespace, you have to create an `EventHub`. The equivalent to an `EventHub` is a `Kafka Topic`.

```shell
az eventhubs eventhub create -g my-resource-group --namespace-name joe-test-2 --name iot-data
```

Now that we created the Namespace (Cluster) and the EventHub (Topic), we still need a way to access it. For this, a Connection String is used. It can be obtained via either Portal, or the Azure CLI:

```shell
az eventhubs namespace authorization-rule keys list -g my-resource-group --namespace-name joe-test-2 --name RootManageSharedAccessKey | jq -r '.primaryConnectionString'
```

This prints out the Connection String to your `EventHub` Namespace.
If you don't have jq installed, you can omit the jq command and copy the primaryConnectionString by hand.

# Configure kaf

Configuring kaf to use the eventhub is very straight-forward; run the following command:

```shell
kaf config add-eventhub my-eventhub --eh-connstring $(az eventhubs namespace authorization-rule keys list -g my-resource-group --namespace-name joe-test-2 --name RootManageSharedAccessKey | jq -r '.primaryConnectionString')
Added EventHub.
```

Note: Replace `joe-test-2` with your `EventHub Namespace` name.

To ensure that kaf sets your new EventHub Namespace as the active cluster, run 
```shell
kaf config use-cluster my-eventhub
Switched to cluster "my-eventhub".
```
# Run commands
Now you can use kaf to interact with your EventHub.

List Topics (EventHubs):

```shell
kaf topics
NAME       PARTITIONS   REPLICAS
iot-data   4            0
```

You see, the `EventHub` we previously created is shown under topics.

We can go a step further. We can create a new topic, which means that a new `EventHub` is created within this `EventHub Namespace`:

```shell
kaf topic create second-topic -p 2
✅ Created topic!
      Topic Name:            second-topic
      Partitions:            2
      Replication Factor:    1
      Cleanup Policy:        delete
```

List topics:

```shell
kaf topics
NAME           PARTITIONS   REPLICAS
iot-data       4            0
second-topic   2            0
```

Even the Azure Portal shows the created topic (EventHub):

![EventHub](/eventhub.png "Azure Portal")

Consuming and Producing data:

To consume, run

```shell
kaf consume second-topic
```

To produce, run

```shell
echo test | kaf produce second-topic
Sent record to partition 1 at offset 0.
```

The consume command will output the message:

```
Partition:   1
Offset:      0
Timestamp:   2020-04-12 23:40:01.591 +0200 CEST
test
```

# Cleaning up

Don't forget to delete your EventHub if you just used it to try kaf out.
