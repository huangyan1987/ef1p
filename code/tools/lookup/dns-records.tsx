/*
Author: Kaspar Etter (https://kasparetter.com/)
Work: Explained from First Principles (https://ef1p.com/)
License: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
*/

import { Fragment, ReactNode } from 'react';

import { getErrorMessage } from '../../utility/error';
import { Dictionary } from '../../utility/record';
import { Time } from '../../utility/time';

import { DynamicOutput, StaticOutput } from '../../react/code';
import { DynamicBooleanEntry, DynamicEntries, DynamicSingleSelectEntry, DynamicTextEntry } from '../../react/entry';
import { Tool } from '../../react/injection';
import { getInput } from '../../react/input';
import { Store } from '../../react/store';
import { getUniqueKey, join } from '../../react/utility';
import { VersionedStore } from '../../react/versioned-store';

import { DnsRecord, DnsResponse, getReverseLookupDomain, mapRecordTypeFromGoogle, RecordType, recordTypes, resolveDomainName, responseStatusCodes } from '../../apis/dns-lookup';

import { setIpInfoInput } from './ip-address';

/* ------------------------------ Output ------------------------------ */

interface DnsResponseState {
    response?: DnsResponse | undefined;
    error?: string | undefined;
}

function parseTimeToLive(ttl: number): string {
    if (ttl > 129600) {
        return (ttl % 86400 !== 0 ? '~' : '') + Math.round(ttl / 86400) + ' days';
    } else if (ttl > 5400) {
        return (ttl % 3600 !== 0 ? '~' : '') + Math.round(ttl / 3600) + ' hours';
    } else if (ttl > 90) {
        return (ttl % 60 !== 0 ? '~' : '') + Math.round(ttl / 60) + ' minutes';
    } else {
        return ttl + ' seconds';
    }
}

// https://datatracker.ietf.org/doc/html/rfc4034#section-2.2
const dnskeyFlags: Dictionary = {
    '0': 'The DNS public key in this record may not be used to verify RRSIG records.',
    '256': 'The DNS public key in this record can be used to verify RRSIG records. It is marked as a zone-signing key (ZSK).',
    '257': 'The DNS public key in this record can be used to verify RRSIG records. It is marked as a key-signing key (KSK).',
};

const dnskeyFlagsDefault = 'This record uses flags which are not supported by this tool.';

// https://www.iana.org/assignments/dns-sec-alg-numbers/dns-sec-alg-numbers.xhtml#dns-sec-alg-numbers-1
const dnskeyAlgorithms: Dictionary = {
    '0': 'This value asks the parent zone to disable DNSSEC for this child zone. It can only be used in CDS and CDNSKEY records. See the section 4 of RFC 8078 for more information.',
    '8': 'This record contains an RSA public key whose private key is used to sign the SHA-256 hash of a message.',
    '13': 'This record contains an ECDSA public key whose private key is used to sign the SHA-256 hash of a message.',
    '14': 'This record contains an ECDSA public key whose private key is used to sign the SHA-384 hash of a message.',
    '15': 'This record contains an Ed25519 public key.',
    '16': 'This record contains an Ed448 public key.',
};

const dnskeyAlgorithmsDefault = 'This record contains a public key whose algorithm is either not known to this tool or not recommended.';

const dnskeyAlgorithmsShort: Dictionary = {
    '8': 'RSA/SHA-256',
    '13': 'ECDSA/SHA-256',
    '14': 'ECDSA/SHA-384',
    '15': 'Ed25519',
    '16': 'Ed448',
};

// https://www.iana.org/assignments/ds-rr-types/ds-rr-types.xhtml#ds-rr-types-1
const dsDigests: Dictionary = {
    '1': 'SHA-1',
    '2': 'SHA-256',
    '3': 'GOST R 34.10-2001',
    '4': 'SHA-384',
};

// https://www.iana.org/assignments/dns-sshfp-rr-parameters/dns-sshfp-rr-parameters.xhtml#dns-sshfp-rr-parameters-1
const sshfpPublicKeyAlgorithms: Dictionary = {
    '0': 'Reserved',
    '1': 'RSA',
    '2': 'DSA',
    '3': 'ECDSA',
    '4': 'Ed25519',
    '5': 'Unassigned',
    '6': 'Ed448',
};

// https://www.iana.org/assignments/dns-sshfp-rr-parameters/dns-sshfp-rr-parameters.xhtml#dns-sshfp-rr-parameters-2
const sshfpHashAlgorithms: Dictionary = {
    '0': 'Reserved',
    '1': 'SHA-1',
    '2': 'SHA-256',
};

// https://www.iana.org/assignments/dane-parameters/dane-parameters.xhtml#certificate-usages
const tlsaCertificateUsages: Dictionary = {
    '0': 'PKIX-TA. (PKIX means that the certificate also has to be trusted in the X.509 public key infrastructure and TA means that the certificate belongs to a trust anchor, i.e. a certificate authority.)',
    '1': 'PKIX-EE. (PKIX means that the certificate also has to be trusted in the X.509 public key infrastructure and EE means that the certificate belongs to the end entity, i.e. the server itself.)',
    '2': 'DANE-TA. (DANE means that the certificate does not have to be trusted in the X.509 public key infrastructure and TA means that the certificate belongs to a trust anchor/certificate authority.)',
    '3': 'DANE-EE. (DANE means that the certificate does not have to be trusted in the X.509 public key infrastructure and EE means that the certificate belongs to the end entity, i.e. the server itself.)',
    '255': 'PrivCert (reserved for private use).',
};

const tlsaCertificateUsagesDefault = 'unassigned. (This is likely an error.)';

// https://www.iana.org/assignments/dane-parameters/dane-parameters.xhtml#selectors
const tlsaSelectors: Dictionary = {
    '0': 'the entire certificate has to match',
    '1': 'only the subject\'s public key information (SPKI) has to match',
    '255': 'this record is used for private purposes',
};

const tlsaSelectorsDefault = 'the domain owner likely made a mistake because this value is unassigned';

// https://www.iana.org/assignments/dane-parameters/dane-parameters.xhtml#matching-types
const tlsaMatchingTypes: Dictionary = {
    '0': 'the entire text of the selected content',
    '1': 'the SHA-256 hash of the selected content',
    '2': 'the SHA-512 hash of the selected content',
    '255': 'used for private purposes',
};

const tlsaMatchingTypesDefault = 'used for an unassigned purpose';

interface Field {
    title: string | ((field: string, record: DnsRecord) => string);
    onClick?: (field: string, record: DnsRecord) => any;
    onContextMenu?: (field: string, record: DnsRecord) => any;
    transform?: (field: string, record: DnsRecord) => string;
}

interface Pattern {
    regexp: RegExp;
    fields: Field[]; // One field required for each part after splitting the data by space.
}

type Parser = (record: DnsRecord) => JSX.Element;
const parseGenericFormat: Parser = record => <StaticOutput title="The data of this record in the hexadecimal generic format.">{record.data.split(' ')[2]?.toUpperCase() ?? record.data}</StaticOutput>;

const onClick = (field: string) => setDnsResolverInputs(field, 'A');
const onContextMenu = (field: string) => window.open('http://' + field.slice(0, -1));

const DNSKEY: Pattern = {
    regexp: /^\d+ \d+ \d+ ([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})$/,
    fields: [
        { title: field => 'Flags: ' + (dnskeyFlags[field] ?? dnskeyFlagsDefault) },
        { title: 'Protocol: For DNSSEC, this value has to be 3.' },
        { title: field => 'Algorithm: ' + (dnskeyAlgorithms[field] ?? dnskeyAlgorithmsDefault) },
        { title: 'The public key encoded in Base64.' },
    ],
};

const DS: Pattern = {
    regexp: /^\d+ \d+ \d+ [A-F0-9]+$/,
    fields: [
        { title: 'Key tag: This value allows resolvers to quickly determine which key is referenced. The value is calculated according to appendix B of RFC 4034. It is basically the DNSKEY record data split into chunks of 16 bits and then summed up.' },
        { title: field => `Algorithm: The same value as in the corresponding DNSKEY record. (${field} stands for ${dnskeyAlgorithmsShort[field] ?? 'an unsupported or not recommended algorithm'}.)` },
        { title: field => `Digest type: This value identifies the algorithm used to hash the public key. (${field} stands for ${dsDigests[field] ?? 'a hash algorithm which is not known to this tool'}.)` },
        { title: field => `Digest: The hash of the public key in the delegated zone. It is displayed in hexadecimal notation, which means that each character represents 4 bits. Since the hash consists of ${field.length} hexadecimal characters, it encodes ${field.length * 4} bits.` },
    ],
};

const recordTypePatterns: { [key in RecordType]: Pattern | Parser } = {
    ANY: record => <span>{record.data}</span>, // Only needed for TypeScript.
    A: {
        regexp: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
        fields: [{
            title: (_, record) => `The IPv4 address of ${record.name} Click to do a reverse lookup. Right click to geolocate the IP address.`,
            onClick: field => setDnsResolverInputs(getReverseLookupDomain(field), 'PTR'),
            onContextMenu: field => { setIpInfoInput(field); window.location.hash = '#tool-lookup-ip-address'; },
        }],
    },
    AAAA: {
        regexp: /^.+$/,
        fields: [{ title: (_, record) => `The IPv6 address of ${record.name}` }],
    },
    CAA: {
        regexp: /^\d{1,3} (issue|issuewild|iodef) "\S+"$/,
        fields: [
            // tslint:disable-next-line:no-bitwise
            { title: field => 'The most significant bit of this number is the issuer critical flag. ' + ((parseInt(field, 10) & 128) ?
                'Because this bit is set to 1, a certificate issuer has to understand the subsequent property before issuing a certificate.' :
                'Because this bit is set to 0, a certificate issuer may issue a certificate without understanding the subsequent property.'
            ) + ' Since the subsequent property has been defined in the original standard (RFC 6844), this flag only matters for future versions of the CAA record with new property types.' },
            { title: field =>
                field === 'issue' && 'The "issue" property authorizes the holder and only the holder of the domain name in the subsequent value to issue normal certificates for the queried domain name.' ||
                field === 'issuewild' && 'The "issuewild" property authorizes the holder and only the holder of the domain name in the subsequent value to issue wildcard certificates for the queried domain name.' ||
                field === 'iodef' && 'The "iodef" (Incident Object Description Exchange Format) property indicates how an unauthorized certificate issuer can report a fraudulent certificate request to the holder of the queried domain name.' ||
                'Error' },
            { title: 'The value which is to be interpreted according to the preceding property.' },
        ],
    },
    CNAME: {
        regexp: /^([a-z0-9_]([-a-z0-9]{0,61}[a-z0-9])?\.)+[a-z][-a-z0-9]{0,61}[a-z0-9]\.$/i,
        fields: [{ title: (_, record) => `The domain name for which ${record.name.slice(0, -1)} is an alias. Click to look up its resource records of the same type. Right click to open the domain in your browser.`, onClick: field => store.setNewStateFromInput('domainName', field), onContextMenu }],
    },
    MX: {
        regexp: /^\d+ (([a-z0-9_]([-a-z0-9]{0,61}[a-z0-9])?\.)+[a-z][-a-z0-9]{0,61}[a-z0-9])?\.$/i,
        fields: [
            { title: 'The priority of the subsequent host. The lower the value, the higher the priority. Several records with the same priority can be used for load balancing, otherwise additional records simply provide redundancy.' },
            { title: (field, record) => field === '.' ? `This MX record indicates that ${record.name.slice(0, -1)} doesn't accept mail.` : `A host which handles incoming mail for ${record.name} Click to look up its IPv4 address. The host name must resolve directly to one or more address records without involving CNAME records.`, onClick },
        ],
    },
    NS: {
        regexp: /^([a-z0-9_]([-a-z0-9]{0,61}[a-z0-9])?\.)+[a-z][-a-z0-9]{0,61}[a-z0-9]\.$/i,
        fields: [{ title: (_, record) => `An authoritative name server for the DNS zone starting at ${record.name} Click to look up its IPv4 address.`, onClick }],
    },
    OPENPGPKEY: parseGenericFormat,
    PTR: {
        regexp: /^([a-z0-9_]([-a-z0-9]{0,61}[a-z0-9])?\.)+[a-z][-a-z0-9]{0,61}[a-z0-9]\.$/i,
        fields: [{ title: 'This is typically the domain name from a reverse DNS lookup. Click to look up its IPv4 address. If it matches the IP address that was looked up in reverse, then the domain holder also holds that IP address. Without a match, the reference in either direction can be fraudulent. Right click to open the domain in your browser.', onClick, onContextMenu }],
    },
    SMIMEA: parseGenericFormat,
    SOA: {
        regexp: /^([a-z0-9_]([-a-z0-9]{0,61}[a-z0-9])?\.)+[a-z][-a-z0-9]{0,61}[a-z0-9]\. ([a-z0-9_]+(-[a-z0-9]+)*\\?\.)+[a-z]{2,63}\. \d+ \d+ \d+ \d+ \d+$/i,
        fields: [
            { title: (_, record) => `The primary name server for the DNS zone ${record.name} Click to look up its IPv4 address.`, onClick },
            { title: field => 'The email address of the administrator responsible for this zone. The first non-escaped period is replaced with an @, so the address actually is ' + field.replace(/\\\./g, ':').replace('.', '@').replace(/:/g, '.') }, // The closing period is coming from the domain name itself.
            { title: 'The serial number for this zone. If it increases, then the zone has been updated.' },
            { title: 'The number of seconds after which secondary name servers should query the primary name server again in order to refresh their copy.' },
            { title: 'The number of seconds after which secondary name servers should retry to request the serial number from the primary name server if it does not respond.' },
            { title: 'The number of seconds after which secondary name servers should stop answering requests for this zone if the primary name server no longer responds.' },
            { title: 'The number of seconds for which the non-existence of a resource record can be cached by DNS resolvers.' },
        ],
    },
    SPF: record => <StaticOutput title={`This record specifies the IP addresses of the outgoing mail servers of ${record.name} SPF stands for Sender Policy Framework. This record type has been obsoleted by RFC 7208. You should just use a TXT record for this now.`}>{record.data}</StaticOutput>,
    SRV: {
        regexp: /^\d+ \d+ \d+ (([a-z0-9_]([-a-z0-9]{0,61}[a-z0-9])?\.)+[a-z][-a-z0-9]{0,61}[a-z0-9])?\.$/i,
        fields: [
            { title: 'The priority of the host at the end of this record. Clients should use the SRV record with the lowest priority value first and fall back to records with higher priority values if the connection fails.' },
            { title: 'A relative weight for records with the same priority. If a service has multiple SRV records with the same priority value, each client should load balance them in proportion to the values of their weight fields.' },
            { title: 'The TCP or UDP port on which the service can be found.' },
            { title: field => 'The host which provides the service. ' + (field === '.' ? 'The period means that the service is not available at this domain.' : 'Click to look up its IPv4 address.'), onClick },
        ],
    },
    SSHFP: {
        regexp: /^\d+ \d+ [0-9A-Fa-f]+$/,
        fields: [
            { title: field => `Public key algorithm: ${field} stands for ${sshfpPublicKeyAlgorithms[field] ?? 'an algorithm unknown to this tool'}.` },
            { title: field => `Hash algorithm: ${field} stands for ${sshfpHashAlgorithms[field] ?? 'an algorithm unknown to this tool'}.` },
            { title: 'The fingerprint of the public key encoded in hexadecimal.', transform: field => field.toUpperCase() },
        ],
    },
    TLSA: {
        regexp: /^\d+ \d+ \d+ [0-9A-Fa-f]+$/,
        fields: [
            { title: field => `Certificate usage: How to verify the server's certificate. ${field} stands for ${tlsaCertificateUsages[field] ?? tlsaCertificateUsagesDefault}` },
            { title: field => `Selector: Which part of the certificate has to match. ${field} means that ${tlsaSelectors[field] ?? tlsaSelectorsDefault}.` },
            { title: field => `Matching type: How the certificate association data is presented. ${field} means that the certificate association data is ${tlsaMatchingTypes[field] ?? tlsaMatchingTypesDefault}.` },
            { title: 'The certificate association data as indicated by the previous fields.', transform: field => field.toUpperCase() },
        ],
    },
    TXT: record => <StaticOutput title="The arbitrary, text-based data of this record.">{record.data}</StaticOutput>,
    DNSKEY,
    DS,
    RRSIG: {
        regexp: /^[a-z0-9]{1,10} \d+ \d+ \d+ \d+ \d+ \d+ (([a-z0-9_]([-a-z0-9]{0,61}[a-z0-9])?\.)*[a-z][-a-z0-9]{0,61}[a-z0-9])?\. ([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})$/i,
        fields: [
            { title: field => `Type covered: The record type covered by the signature in this record. A DNSSEC signature covers all the records of the given type. The records are first sorted, then hashed and signed collectively. (${recordTypes[mapRecordTypeFromGoogle(field.toUpperCase())] ?? 'Unsupported record type.'})`, transform: field => mapRecordTypeFromGoogle(field.toUpperCase()) },
            { title: field => `Algorithm: This number identifies the cryptographic algorithm used to create and verify the signature. (${field} stands for ${dnskeyAlgorithmsShort[field] ?? 'an unsupported or not recommended algorithm'}.)` },
            { title: `Labels: The number of labels in the domain name to which this record belongs. The empty label for the root and a potential wildcard label are not counted. For example, '*.example.com.' has a label count of 2. This allows a validator to determine whether the answer was synthesized for a wildcard subdomain. Since the signature covers the wildcard label instead of the queried subdomain, a validator needs to be able to detect this in order to verify the signature successfully.` },
            { title: field => `Original TTL: Since the actual time to live value is decremented when a cached record is returned, the original time to live value of the signed record needs to be provided in this RRSIG record in order to be able to verify the signature, which covers this value. (${field} seconds are ${parseTimeToLive(Number.parseInt(field, 10))}.)` },
            { title: field => `Signature expiration: The signature in this record may not be used to authenticate the signed resource records after ${Time.fromUnix(field).toLocalTime().toGregorianDateWithTime()}. The date is encoded as the number of seconds elapsed since 1 January 1970 00:00:00 UTC. For record types other than DNSKEY and DS used for key-signing keys (KSKs), the expiration date shouldn't be too far in the future as it limits for how long an attacker can successfully replay stale resource records, which have been replaced by the domain owner.` },
            { title: field => `Signature inception: The signature in this record may not be used to authenticate the signed resource records before ${Time.fromUnix(field).toLocalTime().toGregorianDateWithTime()}. The date is encoded as the number of seconds elapsed since 1 January 1970 00:00:00 UTC. The inception date allows you to already sign records which you intend to publish at a certain point in the future without risking that the signature can be misused until then.` },
            { title: 'Key tag: This value allows resolvers to quickly determine which key needs to be used to verify the signature in this record. The value is calculated according to appendix B of RFC 4034. It is basically the DNSKEY record data split into chunks of 16 bits and then summed up.' },
            { title: 'Signer name: The domain name with the DNSKEY record that contains the public key to validate this signature. It has to be the name of the zone that contains the signed resource records. Click to look up the DNSKEY records of this domain.', onClick: field => setDnsResolverInputs(field, 'DNSKEY') },
            { title: 'Signature: The signature value encoded in Base64.' },
        ],
    },
    NSEC: record => {
        const availableTypes = record.data.split(' ');
        const nextDomain = availableTypes.splice(0, 1)[0];
        return <Fragment>
            <DynamicOutput
                title={`This is the next domain name in this zone. This record indicates that no domain exists between ${record.name.slice(0, -1)} and ${nextDomain} Click to look up its next domain name. Right click to open the domain in your browser.`}
                onClick={() => setDnsResolverInputs(nextDomain, 'NSEC')}
                onContextMenu={event => { onContextMenu(nextDomain); event.preventDefault(); }}
            >
                {nextDomain}
            </DynamicOutput>{' '}
            {join((availableTypes as RecordType[]).map(
                recordType => <span
                    className={recordTypes[recordType] ? 'dynamic-output' : 'static-output'}
                    title={`This entry indicates that ${record.name.slice(0, -1)} has ${['A', 'M', 'N', 'R', 'S'].includes(recordType[0]) ? 'an' : 'a'} ${recordType} record. Click to look up this record type.`}
                    onClick={recordTypes[recordType] ? () => setDnsResolverInputs(record.name, recordType) : undefined }
                >{recordType}</span>,
            ), ' ')}
        </Fragment>;
    },
    NSEC3: record => {
        const availableTypes = record.data.split(' ');
        const [ algorithm, flags, iterations, salt, nextDomain ] = availableTypes.splice(0, 5);
        const owner = record.name.substring(0, record.name.indexOf('.'));
        return <Fragment>
            <StaticOutput title="Algorithm: This value identifies the cryptographic hash function used to hash the subdomains in this zone. 1 stands for SHA-1, which is the only algorithm currently supported.">
                {algorithm}
            </StaticOutput>{' '}
            <StaticOutput title={`Opt-out flag: If this value is 1, there can be unsigned subzones whose hash is between ${owner} and ${nextDomain}. Otherwise, there are no unsigned subzones that fall in this range. By skipping all subzones that don't deploy DNSSEC, the size of this zone can be reduced as fewer NSEC3 records are required.`}>
                {flags}
            </StaticOutput>{' '}
            <StaticOutput title="Iterations: This value specifies how many additional times the hash function is applied to a subdomain name. (A value of 0 means that the subdomain name is hashed only once in total.) By hashing the result of the hash function again, then its result again and so on, the computational cost to brute-force the name of the hashed subdomain can be increased.">
                {iterations}
            </StaticOutput>{' '}
            <StaticOutput title="Salt: Optionally, an arbitrary value can be provided here to be mixed into the hash function in order to make pre-calculated dictionary attacks harder. This prevents an attacker from simultaneously brute-forcing the subdomains of zones which use different salts.">
                {salt}
            </StaticOutput>{' '}
            <StaticOutput title={`This is the hash of the next domain name in this zone. This record indicates that no other subdomain hashes to a value between ${owner} and ${nextDomain} (with the exception of unsigned subzones if the opt-out flag is set).`}>
                {nextDomain}
            </StaticOutput>{' '}
            {join((availableTypes as RecordType[]).map(
                recordType => <StaticOutput title={`This entry indicates that the subdomain which hashes to ${owner} has ${['A', 'M', 'N', 'R', 'S'].includes(recordType[0]) ? 'an' : 'a'} ${recordType} record.`}>
                        {recordType}
                    </StaticOutput>,
            ), ' ')}
        </Fragment>;
    },
    NSEC3PARAM: {
        regexp: /^\d+ \d+ \d+ ([a-f0-9]+|-)$/,
        fields: [
            { title: 'Algorithm: This value identifies the cryptographic hash function used to hash the subdomains in this zone. 1 stands for SHA-1, which is the only algorithm currently supported.' },
            { title: 'Flags: The opt-out flag (see an NSEC3 record for more information) is set to zero in NSEC3PARAM records. Since all other flags are still reserved for future use and thus also set to zero, this value should be zero.' },
            { title: 'Iterations: This value specifies how many additional times the hash function is applied to a subdomain name. (A value of 0 means that the subdomain name is hashed only once in total.) By hashing the result of the hash function again, then its result again and so on, the computational cost to brute-force the name of the hashed subdomain can be increased.' },
            { title: 'Salt: Optionally, an arbitrary value can be provided here to be mixed into the hash function in order to make pre-calculated dictionary attacks harder. This prevents an attacker from simultaneously brute-forcing the subdomains of zones which use different salts.' },
        ],
    },
    CDS: DS,
    CDNSKEY: DNSKEY, // Google doesn't provide a parsed answer, unfortunately: https://issuetracker.google.com/issues/162137940
};

function parseDnsData(record: DnsRecord): ReactNode {
    if (typeof record.type === 'number') {
        return <span title="The data of this unsupported record type.">{record.data}</span>;
    }
    const pattern = recordTypePatterns[record.type];
    if (typeof pattern === 'function') {
        return pattern(record);
    } else {
        if (pattern.regexp.test(record.data)) {
            const fields = record.data.split(' ');
            return join(fields.map((field, index) => {
                const title = pattern.fields[index].title;
                const onClick = pattern.fields[index].onClick;
                const onContextMenu = pattern.fields[index].onContextMenu;
                const transform = pattern.fields[index].transform;
                return <span
                    className={onClick ? 'dynamic-output' : 'static-output'}
                    title={typeof title === 'function' ? title(field, record) : title}
                    onClick={onClick ? () => onClick(field, record) : undefined}
                    onContextMenu={onContextMenu ? event => { onContextMenu(field, record); event.preventDefault(); } : undefined}
                >{transform ? transform(field, record) : field}</span>
            }), ' ');
        } else {
            console.error(`The ${record.type} record '${record.data}' didn't match the expected pattern.`);
            return <span title="The data of this record didn't match the expected pattern.">{record.data}</span>;
        }
    }
}

function turnRecordsIntoTable(records: DnsRecord[]): ReactNode {
    return <table className="text-nowrap dynamic-output-pointer">
        <thead>
            <th>Domain name</th>
            <th>Time to live</th>
            <th>Record type</th>
            <th>Record data</th>
        </thead>
        <tbody>
            {records.map(record => <tr key={getUniqueKey()}>
                <td>{record.name}</td>
                <td title={record.ttl + ' seconds'}>{parseTimeToLive(record.ttl)}</td>
                <td>{typeof record.type === 'number' ? 'Unsupported type ' + record.type : recordTypes[record.type]}</td>
                <td>{parseDnsData(record)}</td>
            </tr>)}
        </tbody>
    </table>;
}

function RawDnsResponseTable({ response, error }: DnsResponseState): JSX.Element | null {
    if (error) {
        return <p>The domain name could not be resolved. Reason: {error}</p>;
    } else if (response) {
        return <Fragment>
            {
                response.status !== 0 &&
                <p className="text-center">{responseStatusCodes[response.status] ?? 'The response has a status code which is not supported by this tool.'}</p>
            }
            {
                response.status === 0 && response.authority.length > 0 &&
                <p className="table-title">Answer section</p>
            }
            {
                response.status === 0 && response.answer.length === 0 &&
                <p className="text-center">No records found for this domain name and record type.</p>
            }
            {
                response.answer.length > 0 &&
                turnRecordsIntoTable(response.answer)
            }
            {
                response.authority.length > 0 &&
                <Fragment>
                    <p className="table-title">Authority section</p>
                    {turnRecordsIntoTable(response.authority)}
                </Fragment>
            }
            {
                (response.answer.length > 0 || response.authority.length > 0) && store.getCurrentState().dnssecOk &&
                <p className="text-center">
                    ⚠️ Please note that this tool doesn't verify DNSSEC signatures.
                    If you rely on its answers, you do so at your own risk!
                </p>
            }
        </Fragment>;
    } else {
        return null; // Nothing is displayed initially.
    }
}

const dnsResponseStore = new Store<DnsResponseState>({});
const DnsResponseTable = dnsResponseStore.injectState(RawDnsResponseTable);

async function updateDnsResponseTable({ domainName, recordType, dnssecOk }: State): Promise<void> {
    try {
        const response = await resolveDomainName(domainName, recordType as RecordType, dnssecOk);
        dnsResponseStore.setState({ response, error: undefined });
    } catch (error) {
        dnsResponseStore.setState({ error: getErrorMessage(error) });
    }
}

/* ------------------------------ Input ------------------------------ */

const domainName: DynamicTextEntry = {
    label: 'Domain',
    tooltip: 'The domain name you are interested in.',
    defaultValue: 'ef1p.com',
    inputType: 'text',
    inputWidth: 222,
    validateIndependently: input =>
        input === '' && 'The domain name may not be empty.' ||
        input.includes(' ') && 'The domain name may not contain spaces.' || // Redundant to the regular expression, just a more specific error message.
        input.length > 253 && 'The domain name may be at most 253 characters long.' ||
        !input.split('.').every(label => label.length < 64) && 'Each label may be at most 63 characters long.' || // Redundant to the regular expression, just a more specific error message.
        !/^[-a-z0-9_\.]+$/i.test(input) && 'You can use only English letters, digits, hyphens, underlines, and dots.' || // Redundant to the regular expression, just a more specific error message.
        !/^(([a-z0-9_]([-a-z0-9]{0,61}[a-z0-9])?\.)*[a-z][-a-z0-9]{0,61}[a-z0-9])?\.?$/i.test(input) && 'The pattern of the domain name is invalid.',
};

const recordType: DynamicSingleSelectEntry = {
    label: 'Type',
    tooltip: 'The DNS record type you want to query.',
    defaultValue: 'A',
    inputType: 'select',
    selectOptions: recordTypes,
};

const dnssecOk: DynamicBooleanEntry = {
    label: 'DNSSEC',
    tooltip: 'Whether to include DNSSEC records in the answer.',
    defaultValue: false,
    inputType: 'switch',
};

interface State {
    domainName: string;
    recordType: string;
    dnssecOk: boolean;
}

const entries: DynamicEntries<State> = {
    domainName,
    recordType,
    dnssecOk,
};

const store = new VersionedStore(entries, 'lookup-dns-records', updateDnsResponseTable);
const Input = getInput(store);

export function setDnsResolverInputs(domainName: string, recordType: RecordType, dnssecOk?: boolean): void {
    store.setInput('domainName', domainName, true);
    store.setInput('recordType', recordType, true);
    if (dnssecOk !== undefined) {
        store.setInput('dnssecOk', dnssecOk, true);
    }
    store.setNewStateFromCurrentInputs();
}

/* ------------------------------ Tool ------------------------------ */

export const toolLookupDnsRecords: Tool = [
    <Fragment>
        <Input
            submit={{
                label: 'Query',
                tooltip: 'Query the records of the given domain name.',
                // tslint:disable-next-line:no-empty
                onClick: () => {},
            }}
        />
        <DnsResponseTable/>
    </Fragment>,
    store,
];
