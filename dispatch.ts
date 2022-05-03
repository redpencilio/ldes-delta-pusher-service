import { moveTriples } from "./support";

export default async function dispatch(changesets) {
	for (const changeset of changesets) {
		await moveTriples([
			{
				inserts: changeset.inserts,
				deletes: changeset.deletes,
			},
		]);
	}
}
