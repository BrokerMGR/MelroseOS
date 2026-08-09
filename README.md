# MelroseOS Enterprise

![Status](https://img.shields.io/badge/Status-Active-success)
![Release](https://img.shields.io/badge/Release-MOS5--016-blue)
![Platform](https://img.shields.io/badge/Platform-Windows-informational)
![Language](https://img.shields.io/badge/PowerShell-7+-5391FE)
![License](https://img.shields.io/badge/Internal-Melrose_Group_Realty-darkgreen)

---

# Enterprise Operating System

MelroseOS is the centralized operating system powering Melrose Group Realty.

It provides a modular architecture for managing brokerage operations, lead management, recruiting, compliance, education, websites, automation, analytics, and enterprise administration.

---

# Core Objectives

- Enterprise CRM
- Lead Migration Engine
- Lead Distribution
- Agent Management
- Recruiting Automation
- Compliance Management
- Education Portal
- Marketing Automation
- Website Synchronization
- Analytics & Reporting
- Enterprise Integrations

---

# Repository Structure

```
MelroseOS
│
├── Build
│
├── CoreModules
│
├── Development
│
├── Documentation
│
├── PROJECTS
│
├── tools
│
├── README.md
│
└── MelroseOS.config
```

---

# Directory Guide

## Build

Contains every enterprise BAT utility.

Examples:

```
Build-MelroseOS.bat
Run-MelroseOS.bat
Install-Module.bat
Commit-MelroseOS.bat
Validate-MelroseOS.bat
New-Module.bat
```

No PowerShell modules belong here.

---

## CoreModules

Contains shared enterprise libraries.

Current:

```
LM-000_Common.ps1
```

These modules are loaded before all production modules.

---

## Development

Development workspace.

Every PowerShell module generated during development is saved here first.

Nothing in this folder is considered production until installed.

---

## Documentation

Project documentation.

Architecture

Standards

Roadmaps

Developer Notes

Release Notes

---

## PROJECTS

Contains enterprise Apps Script projects.

Examples:

- BCC
- EDU
- VERIFY
- INTAKE

---

## tools

Enterprise utilities and production modules.

Lead Migration

Developer Tools

Enterprise Integrations

Automation

---

# Lead Migration

Production modules are installed into

```
tools\LeadMigration\Active
```

Legacy modules are archived in

```
tools\LeadMigration\Legacy
```

Development modules remain inside

```
Development
```

---

# Build Workflow

```
Create Module

↓

Development

↓

Install Module

↓

Validate

↓

Build

↓

Commit

↓

Push

↓

GitHub
```

---

# Standard Development Process

1. Create module

2. Save module into

```
Development
```

3. Execute

```
Build\Run-MelroseOS.bat
```

or

```
Build\Build-MelroseOS.bat
```

4. Enterprise automatically

- Installs modules
- Validates project
- Generates reports
- Creates commit
- Pushes GitHub

---

# Module Naming Standard

```
LM-000_Common.ps1

LM-001_EnterpriseCore.ps1

LM-002_GmailDiscovery.ps1

LM-003_MessageInventory.ps1

LM-004_LeadExtraction.ps1

LM-005_LeadParser.ps1

...
```

---

# Enterprise Rules

Never modify production modules directly.

Always develop inside

```
Development
```

Always validate before committing.

Never bypass the build pipeline.

Never manually edit Active modules.

Always archive obsolete modules.

---

# Current Enterprise Modules

## Complete

```
LM-000_Common

LM-001_EnterpriseCore
```

## Planned

```
LM-002_GmailDiscovery

LM-003_MessageInventory

LM-004_LeadExtraction

LM-005_LeadParser

LM-006_EntityRecognition

LM-007_Normalization

LM-008_DuplicateDetection

LM-009_MergeEngine

LM-010_CRMWriter
```

---

# Release

Current Release

```
MOS5-016
```

Status

```
Enterprise Build System Operational
```

---

# Copyright

MelroseOS Enterprise

Copyright © Melrose Group Realty

All Rights Reserved.