import { createSourceFile, Node, ScriptTarget, SyntaxKind, isTypeAliasDeclaration, isIdentifier, isUnionTypeNode, isLiteralTypeNode, isStringLiteral, isNumericLiteral, isBigIntLiteral, SourceFile, isTypeNode } from 'typescript/lib/typescript';

/**
 * looking out for things like the following
 * EnumDeclaration
 * InterfaceDeclaration
 * TypeAliasDeclaration 
 * ClassDeclaration
 * MergeDeclarationMarker
 * UnionType
 * 
 * Identifier TypeLiteral PropertySignature Identifier  NumberKeyword
 */

const out = createSourceFile('x.ts', 'type X = { x: number; }', ScriptTarget.ES5);
function catNode(node: Node, depth: number = 0): void {
	return node.forEachChild(n => catNode(n, depth + 1));
}
const stringUnion = `type Name = 'a' | 'b' | 'c';`;
const reactComponent = `
type Name = 'a' | 'b' | 'c';
enum Number = {
	one = 1,
	two = 2,
};
interface Props {
	name: Name;
	number: Number;
	occupation: string;
	vehicle: { wheels: number; legs: number };
}
const R: React.SFC<Props> = props => (
	<div {...props} />
);
export default R;`;

type Type = {
};
type Types = {
	defaultExport: Type;
	exports: Type[];
};
function getTypesForExports(fileContent: string): Types {
	return {
		defaultExport: {},
		exports: [],
	}
}

type Generator = {
	identifier?: string;
	get: () => any;
};

/**
 * strategy
 * get to a type declaration
 * map type declaration into generators
 */
function getUnionType(declarationSpec: TypeDeclarationSpec, sourceFile?: SourceFile): Generator | undefined {
	const identifier = declarationSpec.identifier;
	const node = declarationSpec.declaration
	if (isUnionTypeNode(node)) {
		let unionGeneratorLiterals = [];
		node.forEachChild((unionLiteral: Node) => {
			if (isLiteralTypeNode(unionLiteral)) {
				const literals = getLiteralTypes(node)
				unionGeneratorLiterals = unionGeneratorLiterals.concat(literals);
			}
		});
		return {
			identifier,
			get: getUnionTypeGetter(unionGeneratorLiterals),
		};
	}
	return;
}

function getLiteralTypes(node: Node): any[] {
	let literals: any[] = [];
	node.forEachChild((child: Node) => {
		if (isLiteralTypeNode(child)) {
			child.forEachChild((literalChild: Node) => {
				if (isStringLiteral(literalChild)) {
					literals.push(literalChild.text);
				} else if (isNumericLiteral(literalChild)) {
					literals.push(parseFloat(literalChild.text));
				}
			});
		}
	});
	return literals;
}

type TypeDeclarationSpec = { identifier?: string; declaration: Node };
function getOptionalIdentifierAndTypeDeclaration(node: Node, sourceFile?: SourceFile): TypeDeclarationSpec | undefined {
	let identifier: string | undefined = undefined;
	let declaration: Node | undefined = undefined;
	node.forEachChild((child: Node) => {
		if (isIdentifier(child)) {
			identifier = child.text
		}
		if (isTypeNode(child)) {
			declaration = child
		}
	});

	if (declaration) {
		return {
			declaration,
			identifier,
		};
	}
	return;
}

export function findTypeDeclarations(node: Node): Generator[] {
	let generators: Generator[] = [];
	node.forEachChild((child: Node) => {
		if (node.kind !== SyntaxKind.EndOfFileToken) {
			const typeDecSpec = getOptionalIdentifierAndTypeDeclaration(child);
			if (typeDecSpec) {
				console.log('is type dec', child.kind);
				const typeDeclaration = getTypeDeclaration(typeDecSpec);
				if (typeDeclaration) {
					generators.push(typeDeclaration);
				}
			} else if (child.kind !== SyntaxKind.EndOfFileToken) {
				console.log('more types', child.kind);
				const possibleGenerators = findTypeDeclarations(child);
				generators = generators.concat(generators);
			}
		}
	});
	return generators;
}

function getTypeDeclaration(declarationSpec: TypeDeclarationSpec): Generator | undefined {
	return getUnionType(declarationSpec);
}

function getUnionTypeGetter(literals: any[]): () => any {
	let totalCalls = -1;
	return () => {
		totalCalls += 1;
		return literals[totalCalls % literals.length];
	};
}