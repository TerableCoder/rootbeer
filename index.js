const BAMARAMA_BOX = 80086,
	BAMARAMA_BOX_DBID = 493562904,
	ROOT_BEER = 80081,
	TRASH = {
		beer:		80078,
		wine:		80079,
		moongourd:	80082,
		afro:		80089,
		chefHat:	80090
	},
	HATS = [TRASH.afro, TRASH.chefHat],
	ITEMS = [ROOT_BEER, ...Object.values(TRASH)]

module.exports = function RootBeer(mod) {
	mod.settings = {
		version: 2,
		autoTrash: true,
		autoTrashItems: {
			beer: true,
			wine: true,
			moongourd: true,
			afro: true,
			chefHat: true
		}
	};

	
	const command = mod.command || mod.require.command;
	mod.game.initialize('inventory');

	let hooks = [],
		enabled = false,
		timer = null,
		statTotal = 0,
		statRootBeers = 0,
		playerLocation = {x: 0, y: 0, z: 0},
		playerAngle = 0

	command.add('rootbeer', () => { (!enabled ? start : stop)() })

	function start() {
		if(enabled) return

		if(!mod.game.inventory.findInBagOrPockets(BAMARAMA_BOX)) {
			command.message('No bamarama boxes found.')
			return
		}

		enabled = true

		// Toggle hook in case we're still cleaning up from previous run
		mod.game.inventory.on('update', () => {
			inventoryUpdate();
		});

		hook('S_SYSTEM_MESSAGE_LOOT_ITEM', 1, event => {
			if(ITEMS.includes(event.item)) {
				mod.clearTimeout(timer)

				statTotal++
				if(event.item === ROOT_BEER) statRootBeers++

				openBox()
			}
		})

		hook('C_RETURN_TO_LOBBY', 'raw', () => false) // Prevents you from being automatically logged out while AFK

		hook('C_PLAYER_LOCATION', 5, event => {
			Object.assign(playerLocation, event.loc);
			playerAngle = event.w;
		});
		
		hook('S_SPAWN_ME', 3, event => {
			Object.assign(playerLocation, event.loc);
			playerAngle = event.w;
		});

		openBox()
		command.message('Auto-Rootbeer started.')
	}

	function hook() { hooks.push(mod.hook(...arguments)) }

	function openBox() {
		mod.send('C_USE_ITEM', 3, {
            gameId: mod.game.me.gameId,
            id: BAMARAMA_BOX,
			dbid: BAMARAMA_BOX_DBID,
			target: 0n,
			amount: 1,
			dest: 0,
			loc: playerLocation,
			w: playerAngle,
			unk1: 0,
			unk2: 0,
			unk3: 0,
			unk4: true
        })
		timer = mod.setTimeout(openBox, 5000) // Fallback in case a box failed to open
	}

	function inventoryUpdate() {
		if(mod.settings.autoTrash) {
			const strictTrash = !enabled
			//const strictTrash = inventory.size - inventory.items.length < 2 || !enabled

			for(let [name, id] of Object.entries(TRASH))
				if(mod.settings.autoTrashItems[name])
					for(let item of mod.game.inventory.findAllInBagOrPockets(id))
						// Trashing large stacks of items is more bandwidth efficient
						if(item.amount >= 99 || HATS.includes(id) || strictTrash)
							mod.toServer('C_DEL_ITEM', 3, {
								gameId: mod.game.me.gameId,
								pocket: 0,
								slot: (item.slot),
								amount: item.amount
							});
		}

		for(let hat of HATS.map(id => mod.game.inventory.findAllInBagOrPockets(id)))
			while(hat.length >= 2) mod.send('C_MERGE_ITEM', 2, {pocketFrom: 0, slotFrom: hat.pop().slot, pocketTo: 0, slotTo: hat[0].slot})
	}

	function stop() {
		if(!enabled) return

		enabled = false
		mod.clearTimeout(timer)
		timer = null
		unload()
		inventoryUpdate();

		command.message('Auto-Rootbeer stopped.'
			+ (!statTotal ? '' : ` Unboxed ${statRootBeers}/${statTotal} (${(Math.floor(statRootBeers / statTotal * 1000) / 10) || '0'}%).`))

		statTotal = statRootBeers = 0
	}

	function unload() {
		if(hooks.length) {
			for(let h of hooks) mod.unhook(h)

			hooks = []
		}
	}
}