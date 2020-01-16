# IVIS Concepts
IVIS framework has been designed around several concepts namely workspace, namespace, panel, template. Collectively, they are named entities in IVIS.

### Sharing Mechanism

### Workspace
Workspace can contain several panels; workspace is about presenting things in UI. 

### Panel
A panel is part of a Workspace that has a special purpose to present UIs. 

### SignalSet (Sensor)

### Workspace

### Namespace
Namespace is a method to manage security and access control of different entities in the organisational structure; namespace is about visibility based on position of the user in the organisational structure. Those two concepts are fully orthogonal.

#### Permission

A permission is essentially a tripple; the entities are for instance: signal, panel, workspace, namespace; meaning entities have types and the potential operations are tied to their types.

You can see the types and operations in default.yaml (in ivis-core).

## IVIS for Admins
This section targets IVIS admins describing first the permissions/roles, and then workspaces/panels/templates.

### Defining Permissions 
IVIS supports two types of permissions: one per entity, and the other one global. The default permissions has been defined in server/config/default.yaml under roles entry.
### Global Permissions 
The global permissions are then defined under roles.global entry; these permissions are for the Root namespace of your application. In this section, you define all roles of your application; for instance, you define in the configuration the principal role "master", "visitor", "manager", "analyst", "supervisor", etc. Then, you define all global permissions for each role under its permissions entry.
The following configuration defines global permission for the role of master. In terms of global permissions, this role will have the permissions of rebuildPermissions, allocateSignalSet, and manageWorkspaces. These permissions are specific to IVIS-CORE project. You can define your own permissions based on your requirements in the applications considering different roles of your application.

```
roles:
  global:
    master:
      name: "Master"
      admin: true
      description: "All permissions"
      permissions:
      - rebuildPermissions
      - allocateSignalSet
      - manageWorkspaces
      rootNamespaceRole: master
```
In this config, setting "admin" attribute to true will give all permissions to this user within Root namespace by default.
By specifying "rootNamespaceRole" to master, we define the role of user in the Root namespace.
We can also specify "ownNamespaceRole" attribute in order to define user's role in its own namespace (role), .i.e the namespace that a user (role) owns.

### Per Entity Permissions 
In order to have fine-grained permissions at entity level, you can define per entity permissions in IVIS config. For instance, the following config defines permissions on "workspace" entity for the master role.
```
roles:
  workspace:
    master:
      name: "Master"
      description: "All permissions"
      permissions: ["view", "edit", "delete", "share", "createPanel"]
```
When we create a user in IVIS, a user can get a default role. However, this is only the default role of this user, and based on shares that have been given to this user (user's shares), he/she may get other roles for other entities. With this sharing mechanism, each user is not bounded to its default role.

The idea of this configuration is that the operations are too fine-grained to be set via UI; so you define what these roles mean in terms of the fine-grained permissions. Then in the UI, you share a entity (e.g. a workspace, or a panel) with someone in the particular role; i.e. you can have a role "master" to a particular panel which would entitle you to do anything with the particular panel.

Thus, recapping "per entity permissions" defines what permissions a particular role has to an entity; therefore, if you make some users a "master" for a namespace (e.g. "root"), this user will have all the permissions to the particular namespace and its children. Effectively, making a user a "master" to the "Root" namespace, he/she will get access to everything. 
But you make a user a "master" to some namespace lower in the namespace hierarchy, which would give the user access to only the subtree.

In summary, in order to see the effect of "per entity permissions", IVIS admins have to share entities with respective users; so these things are coupled together.
The complete config of "per entity permissions" for IVIS-CORE project are as the following:

```
roles:
  namespace:
    master:
      name: "Master"
      description: "All permissions"
      permissions: ["view", "edit", "delete", "share", "createNamespace", "createTemplate", "createWorkspace", "createPanel", "createSignal", "createSignalSet", "manageUsers"]
      children:
        namespace: ["view", "edit", "delete", "share", "createNamespace", "createTemplate", "createWorkspace", "createPanel", "createSignal", "createSignalSet", "manageUsers"]
        template: ["view", "edit", "delete", "share", "execute"]
        workspace: ["view", "edit", "delete", "share", "createPanel"]
        panel: ["view", "edit", "delete", "share"]
        signal: ["view", "edit", "delete", "insert", "query", "share"]
        signalSet: ["view", "edit", "delete", "insert", "query", "share", "manageSignals", "reindex", "createSignal"]

  template:
    master:
      name: "Master"
      description: "All permissions"
      permissions: ["view", "edit", "delete", "share", "execute", "createPanel"]

  workspace:
    master:
      name: "Master"
      description: "All permissions"
      permissions: ["view", "edit", "delete", "share", "createPanel"]

  panel:
    master:
      name: "Master"
      description: "All permissions"
      permissions: ["view", "edit", "delete", "share"]

  signal:
    master:
      name: "Master"
      description: "All permissions"
      permissions: ["view", "edit", "delete", "query", "share"]

  signalSet:
    master:
      name: "Master"
      description: "All permissions"
      permissions: ["view", "edit", "delete", "insert", "query", "share", "manageSignals", "reindex", "createSignal"]
      # Manage signals gives full permission to all signals contained in a signalSet
```


## IVIS for developers
This section describes the task API for communication with IVIS core.

### Primary attributes 
Each job once stared receives attributes in json format on the standard input, file descriptor 0. Example of data:
```json
{
  "params": {
    "sigSet": "example_set",
    "ts_signal": "ts",
    "source_signal": "source"
  },
  "entities": {
    "signalSets": {
      "example_set": {
        "index": "signal_set_1",
        "name": "Example set",
        "namespace": 1
      }
    },
    "signals": {
      "example_set": {
        "source": {
          "field": "s1",
          "name": "Source of values",
          "namespace": 1
        },
        "ts": {
          "field": "s2",
          "name": "Timestamp",
          "namespace": 1
        }
      }
    }
  },
  "state": {
    "index": "signal_set_2",
    "type": "_doc",
    "fields": {
      "created_signal": "s3"
    }
  },
  "es": {
    "host": "localhost",
    "port": "9200"
  }
}
```
There are 4 main JSON objects in incoming data: 
- `params`
- `entities`
- `state`
- `es`

`params` are parameters from the job being run that were set previously in GUI of the job's settings page. It is always a pair of parameter's identifier and selected value.
 
`entities` have 2 JSON objects, `signalSets` and `signals`. Each signal set found in the parameters of the job is listed in the `signalSets` under his CID with 3 properties, `index`, that is corresponding index in the ElasticSearch, `name` and `namespace`. Each signal found in the parameters is listed in the `signals` object under CID of the signal set it belongs to under its CID with 3 properties, `field`, that is field in ElasticSearch in the index of its signal set, `name` and `namespace`.

`state` is job's state stored in the ElasticSearch. Content of `state` depends completely on what is stored there in the job's code. More on that later. 

`es` contains information about ElasticSearch instance. Under `host` is host's address and under `port` is port it is listening on.

### Job requests
Job can send request to the IVIS core. Requests are accepted on the file descriptor 3 in JSON format and answer is received on the standard input.  There are 2 types of requests job can send:
- `store` 
- `create`

`store` will request storing given state. This state is received on each run start in `state` object mentioned previously. `create` will request creating new signal set and signals.
Example of a `store` request:
 ```json
{
  "id": 1,
  "type": "store",
  "state": {
    "index": "signal_set_2",
    "type": "_doc",
    "fields": {
      "created_signal": "s3"
    }
  }
}
```
and received answer:
```json
{
  "id": 1
}
```
Each request has `type`, either `store` or `create`, that determines requested action. If there is `id` present in the request it will be copied to the answer unless the JSON format was incorrect. If there is no `error` present, request succeeded. Otherwise `error` with error message will be present in the answer:
```json
{
  "id": 1,
  "error": "Request failed"
}
```
In the `store` request everything in `state` object will be stored.

`create` request looks like this:
```json
{
  "type": "create",
  "sigSet": {
      "cid" : "created_set",
      "name" : "API test" ,
      "namespace": 1,
      "description" : "API test" ,
      "signals": [
        {
          "cid": "created_signal",
          "name": "showcase signal",
          "description": "api showcase signal",
          "namespace": 1,
          "type": "text",
          "indexed": false,
          "settings": {} 
        }       
      ]
  }
}
```

## IVIS Extension for Domain-Specific Applications
IVIS-CORE can be extended thourgh IVIS extensions mechanism, and plug-ins in order to develop Domain-Specific Applications. For that, we need to create another project in another repository for the Domain-Specific Application, where we include the core as a git submodule and add domain-specific modules, and components, import/management components and possibly some branding.
