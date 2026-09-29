create table if not exists public.contract_configs (
  id uuid primary key default gen_random_uuid(),
  contract_version text not null default '1.0.0',
  contract_content text not null,
  last_updated timestamptz not null default now()
);

create table if not exists public.contract_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  email text,
  timestamp timestamptz not null default now(),
  ip_address text,
  browser_user_agent text,
  contract_version text not null,
  accepted boolean not null default true
);

create index if not exists contract_acceptances_user_version_idx
  on public.contract_acceptances (user_id, contract_version)
  where accepted = true;

insert into public.contract_configs (contract_version, contract_content)
select
  '1.0.0',
  'By accessing, registering on, subscribing to, clicking "I Agree", creating an account, or otherwise using the LEGATRIXON Platform, the user expressly acknowledges and agrees that they have read, understood, and accepted these Terms and Conditions, Privacy Policy, and all other policies published by LEGATRIXON, and such acceptance shall constitute a valid, legally binding, and enforceable electronic contract having the same legal effect as a written agreement signed physically. The user further agrees not to copy, reproduce, modify, distribute, sell, license, commercialize, scrape, extract, download, reverse engineer, decompile, disassemble, derive, or attempt to access the source code, software architecture, algorithms, databases, AI models, workflows, proprietary information, trade secrets, business methods, designs, functionalities, or any other intellectual or technological components of the Platform, nor create, develop, operate, support, or assist any website, software, application, platform, service, or product that is substantially similar to, derived from, competitive with, or intended to replicate any part of LEGATRIXON. Any unauthorized use, infringement, misuse, circumvention of security measures, or breach of this Agreement shall constitute a material violation entitling LEGATRIXON to immediately suspend or terminate access, seek injunctive relief, recover damages, legal costs, and pursue all civil, criminal, and statutory remedies available under applicable law without prejudice to any other rights or remedies available to it.'
where not exists (select 1 from public.contract_configs);

notify pgrst, 'reload schema';