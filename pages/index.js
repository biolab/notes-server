import {getCollectionProps} from "../utils/getCollectionProps";
import {Collection} from "../components/Collection/Collection";

export const getStaticProps =  async () => getCollectionProps([]);
export default Collection;
