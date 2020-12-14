import {
	ethereum,
	Address,
	BigInt,
} from '@graphprotocol/graph-ts'

import {
	Account,
	TokenRegistry,
	Token,
	Balance,
	Transfer,
	Approval,
} from '../generated/schema'

import {
	IERC1155,
	TransferBatch  as TransferBatchEvent,
	TransferSingle as TransferSingleEvent,
	URI            as URIEvent,
} from '../generated/IERC1155/IERC1155'

import {
	constants,
	events,
	integers,
	transactions,
} from '@amxx/graphprotocol-utils'



function registerTransfer(
	event:    ethereum.Event,
	suffix:   String,
	operator: Address,
	from:     Address,
	to:       Address,
	token:    BigInt,
	value:    BigInt)
: void
{
	let ev = new Transfer(events.id(event).concat(suffix))
	ev.transaction = transactions.log(event).id
	ev.timestamp   = event.block.timestamp
	ev.token       = event.address.toHex().concat('-').concat(token.toHex())
	ev.operator    = operator.toHex()
	ev.from        = from.toHex()
	ev.to          = to.toHex()
	ev.value       = value

	if (ev.from != constants.ADDRESS_ZERO) {
		let id      = ev.token.concat('-').concat(ev.from)
		let balance = Balance.load(id)
		// first time balance is seen
		if (balance == null) {
			let balance     = new Balance(id)
			balance.token   = ev.token
			balance.account = ev.from
			balance.value   = IERC1155.bind(event.address).balanceOf(from, token)
		} else {
			balance.value   = integers.decrement(balance.value, value)
		}
		balance.save()
		ev.fromBalance = id
	}

	if (ev.to != constants.ADDRESS_ZERO) {
		let id      = ev.token.concat('-').concat(ev.to)
		let balance = Balance.load(id)
		// first time balance is seen
		if (balance == null) {
			let balance     = new Balance(id)
			balance.token   = ev.token
			balance.account = ev.to
			balance.value   = IERC1155.bind(event.address).balanceOf(from, token)
		} else {
			balance.value   = integers.increment(balance.value, value)
		}
		balance.save()
		ev.toBalance = id
	}
	ev.save()
}

export function handleTransferSingle(event: TransferSingleEvent): void
{
	let registry = new TokenRegistry(event.address.toHex())
	let operator = new Account(event.params.operator.toHex())
	let from     = new Account(event.params.from.toHex())
	let to       = new Account(event.params.to.toHex())
	registry.save()
	operator.save()
	from.save()
	to.save()

	let token = new Token(registry.id.concat('-').concat(event.params.id.toHex()))
	token.registry   = registry.id
	token.identifier = event.params.id
	token.save()

	registerTransfer(event, "", event.params.operator, event.params.from, event.params.to, event.params.id, event.params.value)
}

export function handleTransferBatch(event: TransferBatchEvent): void
{
	let registry = new TokenRegistry(event.address.toHex())
	let operator = new Account(event.params.operator.toHex())
	let from     = new Account(event.params.from.toHex())
	let to       = new Account(event.params.to.toHex())
	registry.save()
	operator.save()
	from.save()
	to.save()

	let ids    = event.params.ids
	let values = event.params.values
	for (let i = 0;  i < ids.length; ++i)
	{
		let token = new Token(registry.id.concat('-').concat(ids[i].toHex()))
		token.registry   = registry.id
		token.identifier = ids[i]
		token.save()

		registerTransfer(event, "-".concat(i.toString()), event.params.operator, event.params.from, event.params.to, ids[i], values[i])
	}
}


export function handleURI(event: URIEvent): void
{
	let registry = new TokenRegistry(event.address.toHex())
	let token    = new Token(registry.id.concat('-').concat(event.params.id.toHex()))
	token.URI = event.params.value
	registry.save()
	token.save()
}
