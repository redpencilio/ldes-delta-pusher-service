import { moveTriples } from "../support";
import { DeltaChangeset } from "../types";

export default async function dispatch(changesets: DeltaChangeset[]) {
	for (const changeset of changesets) {
		await moveTriples([
			{
				inserts: changeset.inserts,
				deletes: changeset.deletes,
			},
		]);
	}
}
